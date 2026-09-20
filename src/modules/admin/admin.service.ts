import { prisma } from "../../lib/prisma";
import {
  SystemRole,
  VerificationStatus,
  PrescriptionStatus,
  InvoiceStatus,
} from "../../../generated/prisma/client";
import { getPaginationParams, buildPaginatedResult } from "../../utils/pagination";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";

export const adminService = {  // User management
  async listUsers() {
    return prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        systemRole: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async updateUser(
    id: string,
    data: { systemRole?: SystemRole; isActive?: boolean },
  ) {
    return prisma.user.update({
      where: { id },
      data: {
        ...(data.systemRole && { systemRole: data.systemRole }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  },

  // Soft delete / deactivate (Section 8.2). A hard delete is not allowed: the
  // user owns workspaces and is referenced by prescriptions, profiles, etc., so
  // we deactivate the account, revoke sessions and set memberships inactive —
  // all business records are preserved.
  async deleteUser(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      return { id, deactivated: false };
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: { isActive: false },
      }),
      prisma.session.updateMany({
        where: { userId: id },
        data: { isActive: false },
      }),
      prisma.membership.updateMany({
        where: { userId: id },
        data: { status: "INACTIVE" },
      }),
    ]);

    return { id, deactivated: true };
  },

  // Subscription plan feature limits
  async listPlans() {
    return prisma.subscriptionVariant.findMany({
      include: {
        planFeatures: {
          include: { feature: true },
        },
      },
    });
  },

  /**
   * Creates a subscription plan. Price and availability are admin-owned data —
   * never hardcoded in the client. New plans are active unless told otherwise.
   */
  async createPlan(data: {
    variantName: string;
    price: number;
    dailyPrescriptionLimit?: number;
    description?: Record<string, string>;
    isActive?: boolean;
  }) {
    if (!data.variantName?.trim()) {
      throw createAppError("Plan name is required", Status.BAD_REQUEST);
    }

    return prisma.subscriptionVariant.create({
      data: {
        variantName: data.variantName.trim(),
        description: (data.description ?? { en: "", bn: "" }) as any,
        price: Number(data.price ?? 0),
        dailyPrescriptionLimit: Number(data.dailyPrescriptionLimit ?? 0),
        isActive: data.isActive ?? true,
      },
    });
  },

  /**
   * Updates a plan's name, price, prescription limit, description and/or
   * active state. Historical subscription/payment rows keep their own snapshot
   * of the price they were sold at, so editing here never rewrites them.
   */
  async updatePlan(
    variantId: string,
    data: {
      variantName?: string;
      price?: number;
      dailyPrescriptionLimit?: number;
      description?: Record<string, string>;
      isActive?: boolean;
    },
  ) {
    const existing = await prisma.subscriptionVariant.findUnique({
      where: { id: variantId },
      select: { id: true },
    });

    if (!existing) {
      throw createAppError("Plan not found", Status.NOT_FOUND);
    }

    const update: Record<string, unknown> = {};
    if (data.variantName !== undefined) {
      if (!String(data.variantName).trim()) {
        throw createAppError("Plan name cannot be empty", Status.BAD_REQUEST);
      }
      update.variantName = String(data.variantName).trim();
    }
    if (data.price !== undefined) update.price = Number(data.price);
    if (data.dailyPrescriptionLimit !== undefined) {
      update.dailyPrescriptionLimit = Number(data.dailyPrescriptionLimit);
    }
    if (data.description !== undefined) update.description = data.description;
    if (data.isActive !== undefined) update.isActive = Boolean(data.isActive);

    return prisma.subscriptionVariant.update({
      where: { id: variantId },
      data: update as any,
    });
  },

  async setPlanFeatureLimit(
    variantId: string,
    featureId: string,
    limitValue: number | null,
  ) {
    // Upsert PlanFeature
    return prisma.planFeature.upsert({
      where: { variantId_featureId: { variantId, featureId } },
      update: { limitValue },
      create: { variantId, featureId, limitValue },
    });
  },

  /**
   * All platform features (the toggles an admin can attach to a plan) plus
   * their current global availability flag.
   */
  async listFeatures() {
    return prisma.feature.findMany({
      include: { featureFlags: { select: { isEnabledGlobally: true } } },
      orderBy: [{ category: "asc" }, { key: "asc" }],
    });
  },

  /**
   * Enables/disables a feature for a plan and sets its limit when enabled.
   * The presence of a PlanFeature row means "enabled"; `limitValue = null`
   * means "unlimited". There are no hardcoded plan names — this is the single
   * source of truth for what a plan allows.
   */
  async setPlanFeature(
    variantId: string,
    featureId: string,
    enabled: boolean,
    limitValue: number | null,
  ) {
    if (!enabled) {
      await prisma.planFeature.deleteMany({ where: { variantId, featureId } });
      return { variantId, featureId, enabled: false, limitValue: null };
    }

    const row = await prisma.planFeature.upsert({
      where: { variantId_featureId: { variantId, featureId } },
      update: { limitValue },
      create: { variantId, featureId, limitValue },
    });
    return { ...row, enabled: true };
  },

  async toggleFeatureFlag(featureId: string, enabled: boolean) {
    return prisma.featureFlag.upsert({
      where: { featureId },
      update: { isEnabledGlobally: enabled },
      create: { featureId, isEnabledGlobally: enabled },
    });
  },

  // Audit trail viewer
  async listAuditLogs(query: {
    page?: unknown;
    limit?: unknown;
    userId?: string;
    workspaceId?: string;
    actionType?: string;
    entityType?: string;
  }) {
    const { page, limit, skip } = getPaginationParams(query.page, query.limit);

    const where: any = {};
    if (query.userId) where.userId = query.userId;
    if (query.workspaceId) where.workspaceId = query.workspaceId;
    if (query.actionType) where.actionType = query.actionType;
    if (query.entityType) where.entityType = query.entityType;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
          workspace: { select: { id: true, name: true, type: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return buildPaginatedResult(items, total, page, limit);
  },

  // Login history viewer
  async listLoginHistory(query: {
    page?: unknown;
    limit?: unknown;
    userId?: string;
    status?: string;
  }) {
    const { page, limit, skip } = getPaginationParams(query.page, query.limit);

    const where: any = {};
    if (query.userId) where.userId = query.userId;
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      prisma.loginHistory.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.loginHistory.count({ where }),
    ]);

    return buildPaginatedResult(items, total, page, limit);
  },

  // Admin dashboard statistics
  async getDashboardStats() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const [
      totalUsers,
      activeUsers,
      totalDoctors,
      verifiedDoctors,
      pendingDoctors,
      totalInstitutions,
      totalWorkspaces,
      totalPatients,
      totalPrescriptions,
      finalizedPrescriptions,
      appointmentsToday,
      activeSubscriptions,
      pendingVerifications,
      monthlyRevenue,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.doctor.count(),
      prisma.doctor.count({
        where: { verificationStatus: VerificationStatus.APPROVED },
      }),
      prisma.doctor.count({
        where: { verificationStatus: VerificationStatus.PENDING },
      }),
      prisma.institution.count(),
      prisma.workspace.count(),
      prisma.patient.count({ where: { isDeleted: false } }),
      prisma.prescription.count({ where: { isDeleted: false } }),
      prisma.prescription.count({
        where: {
          isDeleted: false,
          status: PrescriptionStatus.FINALIZED,
        },
      }),
      prisma.appointment.count({
        where: { appointmentDate: { gte: dayStart } },
      }),
      prisma.subscription.count({ where: { isActive: true } }),
      prisma.verificationRequest.count({
        where: {
          status: {
            in: [VerificationStatus.PENDING, VerificationStatus.UNDER_REVIEW],
          },
        },
      }),
      prisma.invoice.aggregate({
        _sum: { amount: true },
        where: {
          status: InvoiceStatus.PAID,
          paidAt: { gte: monthStart },
        },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
      },
      doctors: {
        total: totalDoctors,
        verified: verifiedDoctors,
        pending: pendingDoctors,
      },
      institutions: totalInstitutions,
      workspaces: totalWorkspaces,
      patients: totalPatients,
      prescriptions: {
        total: totalPrescriptions,
        finalized: finalizedPrescriptions,
      },
      appointmentsToday,
      activeSubscriptions,
      pendingVerifications,
      monthlyRevenue: monthlyRevenue._sum.amount ?? 0,
    };
  },

  // Platform-wide workspace directory (super admin only)
  async listWorkspaces() {
    return prisma.workspace.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: {
          select: {
            memberships: true,
            patients: true,
            prescriptions: true,
            chambers: true,
          },
        },
      },
    });
  },

  // Medicine catalog management (platform reference data, not workspace-scoped)
  async listMedicines(query: {
    q?: string | undefined;
    page?: unknown;
    limit?: unknown;
  }) {
    const { page, limit, skip } = getPaginationParams(query.page, query.limit);
    const q = query.q?.trim();

    const where = q
      ? {
          OR: [
            { brandName: { contains: q, mode: "insensitive" as const } },
            { generic: { contains: q, mode: "insensitive" as const } },
            { manufacturer: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.medicine.findMany({
        where,
        skip,
        take: limit,
        orderBy: { brandName: "asc" },
      }),
      prisma.medicine.count({ where }),
    ]);

    return buildPaginatedResult(items, total, page, limit);
  },

  async createMedicine(data: {
    brandName: string;
    generic: string;
    dosageForm?: string;
    type?: string;
    strength?: string;
    manufacturer?: string;
    slug?: string;
  }) {
    const brandName = data.brandName?.trim();
    const generic = data.generic?.trim();
    if (!brandName || !generic) {
      throw new Error("brandName and generic are required");
    }

    const slugify = (v: string) =>
      v
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");

    const baseSlug =
      data.slug?.trim() ||
      `${slugify(brandName)}-${slugify(data.strength || generic)}`;

    // Ensure a unique slug
    let slug = baseSlug;
    let suffix = 1;
    while (await prisma.medicine.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix++}`;
    }

    return prisma.medicine.create({
      data: {
        brandName,
        generic,
        slug,
        dosageForm: data.dosageForm || "Tablet",
        type: data.type || data.dosageForm || "Tablet",
        strength: data.strength || null,
        manufacturer: data.manufacturer || null,
      },
    });
  },
};
