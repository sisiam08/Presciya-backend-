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
import { parse as parseCsv } from "csv-parse/sync";

export const adminService = {  
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

  
  async listPlans() {
    return prisma.subscriptionVariant.findMany({
      
      
      
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        planFeatures: {
          include: { feature: true },
        },
      },
    });
  },

  
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

    
    
    
    
    const nameTaken = await prisma.subscriptionVariant.findFirst({
      where: {
        variantName: { equals: data.variantName.trim(), mode: "insensitive" },
      },
      select: { id: true },
    });
    if (nameTaken) {
      throw createAppError(
        "A plan with this name already exists. Rename the existing plan instead of creating a new one.",
        Status.CONFLICT,
      );
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
      const nextName = String(data.variantName).trim();
      
      
      
      const clash = await prisma.subscriptionVariant.findFirst({
        where: {
          variantName: { equals: nextName, mode: "insensitive" },
          id: { not: variantId },
        },
        select: { id: true },
      });
      if (clash) {
        throw createAppError(
          "Another plan already uses this name.",
          Status.CONFLICT,
        );
      }
      update.variantName = nextName;
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
    
    return prisma.planFeature.upsert({
      where: { variantId_featureId: { variantId, featureId } },
      update: { limitValue },
      create: { variantId, featureId, limitValue },
    });
  },

  
  async listFeatures() {
    return prisma.feature.findMany({
      include: { featureFlags: { select: { isEnabledGlobally: true } } },
      orderBy: [{ category: "asc" }, { key: "asc" }],
    });
  },

  
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
  // ── CSV Import ─────────────────────────────────────────────────────────────
  async importMedicinesFromCsv(
    fileBuffer: Buffer,
    onDuplicate: "skip" | "update" = "skip",
  ) {
    // ── 1. Parse CSV ──────────────────────────────────────────────────────────
    let rawRows: Record<string, string>[];
    try {
      rawRows = parseCsv(fileBuffer, {
        columns: true,         // use first row as header
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        bom: true,             // strip BOM if present
      }) as Record<string, string>[];
    } catch (err: any) {
      throw createAppError(
        `CSV parsing failed: ${err.message}`,
        Status.BAD_REQUEST,
      );
    }

    if (!rawRows || rawRows.length === 0) {
      throw createAppError("The CSV file is empty or has no data rows.", Status.BAD_REQUEST);
    }

    // ── 2. Normalise header names (lowercase, strip spaces/underscores) ────────
    const normaliseKey = (k: string) =>
      k.toLowerCase().replace(/[\s_-]+/g, "");

    const normalisedRows = rawRows.map((row) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        out[normaliseKey(k)] = (v ?? "").trim();
      }
      return out;
    });

    // Expected normalised keys
    const COL_BRAND    = "brandname";
    const COL_SLUG     = "slug";
    const COL_DOSAGE   = "dosageform";
    const COL_GENERIC  = "generic";
    const COL_STRENGTH = "strength";
    const COL_MFR      = "manufacturer";

    // ── 3. Validate headers ───────────────────────────────────────────────────
    const requiredCols = [COL_BRAND, COL_SLUG, COL_DOSAGE, COL_GENERIC];
    const firstRow = normalisedRows[0]!; // safe: we checked rawRows.length > 0 above
    const missingCols = requiredCols.filter((c) => !(c in firstRow));
    if (missingCols.length > 0) {
      // Build human-readable names for the error message
      const colMap: Record<string, string> = {
        brandname:  "brand name",
        slug:       "slug",
        dosageform: "dosage form",
        generic:    "generic",
      };
      throw createAppError(
        `CSV is missing required column(s): ${missingCols.map((c) => colMap[c] ?? c).join(", ")}`,
        Status.BAD_REQUEST,
      );
    }

    // ── 4. Row-level validation ───────────────────────────────────────────────
    const validRows: {
      brandName: string;
      slug: string;
      dosageForm: string;
      generic: string;
      strength: string | null;
      manufacturer: string | null;
    }[] = [];
    const rowErrors: { row: number; error: string }[] = [];

    for (let i = 0; i < normalisedRows.length; i++) {
      const row = normalisedRows[i] as Record<string, string>; // safe: iterating within bounds
      const rowNum = i + 2; // 1-indexed, +1 for header row

      const brandName  = (row[COL_BRAND] ?? "").trim();
      const slug       = (row[COL_SLUG] ?? "").trim();
      const dosageForm = (row[COL_DOSAGE] ?? "").trim();
      const generic    = (row[COL_GENERIC] ?? "").trim();
      const strength   = (row[COL_STRENGTH] ?? "").trim() || null;
      const manufacturer = (row[COL_MFR] ?? "").trim() || null;

      const fieldErrors: string[] = [];
      if (!brandName) fieldErrors.push("brand name is required");
      if (!slug)      fieldErrors.push("slug is required");
      if (!dosageForm) fieldErrors.push("dosage form is required");
      if (!generic)   fieldErrors.push("generic is required");

      // Validate slug format: only lowercase letters, digits, hyphens
      if (slug && !/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(slug)) {
        fieldErrors.push(
          "slug must contain only lowercase letters, digits, and hyphens (e.g. napa-500mg)",
        );
      }

      if (fieldErrors.length > 0) {
        rowErrors.push({ row: rowNum, error: fieldErrors.join("; ") });
        continue;
      }

      validRows.push({ brandName, slug, dosageForm, generic, strength, manufacturer });
    }

    if (validRows.length === 0) {
      return {
        total: rawRows.length,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: rowErrors,
        message: "No valid rows found; all rows had validation errors.",
      };
    }

    // ── 5. Slug uniqueness check (batch) ──────────────────────────────────────
    const slugs = [...new Set(validRows.map((r) => r.slug))];
    const existing = await prisma.medicine.findMany({
      where: { slug: { in: slugs } },
      select: { id: true, slug: true },
    });
    const existingSlugMap = new Map(existing.map((m) => [m.slug, m.id]));

    // ── 6. Detect intra-CSV duplicate slugs ───────────────────────────────────
    const seenSlugs = new Map<string, number>(); // slug → first rowIndex in validRows
    const deduped: typeof validRows = [];
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i]!; // safe: iterating within bounds of typed array
      if (seenSlugs.has(r.slug)) {
        // Treat as duplicate of first occurrence within the file
        rowErrors.push({
          row: i + 2, // approximate; exact row unknown after filtering
          error: `duplicate slug "${r.slug}" within the CSV (first seen earlier); row skipped`,
        });
      } else {
        seenSlugs.set(r.slug, i);
        deduped.push(r);
      }
    }

    // ── 7. Categorise rows ────────────────────────────────────────────────────
    const toInsert = deduped.filter((r) => !existingSlugMap.has(r.slug));
    const toUpdate = deduped.filter((r) => existingSlugMap.has(r.slug));

    // ── 8. Execute inserts in one bulk query and updates transactionally ───────
    let inserted = 0;
    let updated  = 0;
    let skipped  = 0;

    // Insert new medicines
    if (toInsert.length > 0) {
      const result = await prisma.medicine.createMany({
        data: toInsert.map((r) => ({
          brandName:    r.brandName,
          slug:         r.slug,
          dosageForm:   r.dosageForm,
          type:         r.dosageForm,
          generic:      r.generic,
          strength:     r.strength,
          manufacturer: r.manufacturer,
        })),
      });
      inserted = result.count;
    }

    // Handle duplicates
    if (toUpdate.length > 0) {
      if (onDuplicate === "update") {
        await prisma.$transaction(
          async (tx) => {
            await Promise.all(
              toUpdate.map((r) => {
                const id = existingSlugMap.get(r.slug)!;
                return tx.medicine.update({
                  where: { id },
                  data: {
                    brandName:    r.brandName,
                    dosageForm:   r.dosageForm,
                    type:         r.dosageForm,
                    generic:      r.generic,
                    strength:     r.strength || null,
                    manufacturer: r.manufacturer || null,
                  },
                });
              }),
            );
          },
          {
            maxWait: 10_000,
            timeout: 60_000,
          },
        );
        updated = toUpdate.length;
      } else {
        // skip
        skipped = toUpdate.length;
      }
    }

    return {
      total:    rawRows.length,
      inserted,
      updated,
      skipped,
      errors:   rowErrors,
      message:  `Import complete. ${inserted} inserted, ${updated} updated, ${skipped} skipped, ${rowErrors.length} error(s).`,
    };
  },
};
