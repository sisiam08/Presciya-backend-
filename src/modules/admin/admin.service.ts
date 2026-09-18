import { prisma } from "../../lib/prisma";
import {
  SystemRole,
  VerificationStatus,
  PrescriptionStatus,
  InvoiceStatus,
} from "../../../generated/prisma/client";
import { getPaginationParams, buildPaginatedResult } from "../../utils/pagination";

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

  async deleteUser(id: string) {
    return prisma.user.delete({ where: { id } });
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
};
