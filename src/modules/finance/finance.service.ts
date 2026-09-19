import { prisma } from "../../lib/prisma";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import { Prisma } from "../../../generated/prisma/client";
import {
  FinancialTransactionType,
  MembershipStatus,
  AuditActionType,
  AuditEntityType,
} from "../../../generated/prisma/enums";
import { AuditService } from "../audit/audit.service";
import { PermissionServices } from "../permission/permission.service";

// ─── Date helpers (local time — consistent with the server's clock) ──────────

// Parse a "YYYY-MM-DD" (or ISO) string into a Date at local midnight so the
// stored transaction date matches the calendar day the user picked.
const parseTransactionDate = (value: string): Date => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      0,
      0,
      0,
      0,
    );
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createAppError("Invalid date", Status.BAD_REQUEST);
  }
  return parsed;
};

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

// Week starts on Saturday (matches the app's en-BD weekday display).
const startOfWeek = (d: Date) => {
  const daysSinceSaturday = (d.getDay() + 1) % 7;
  const start = startOfDay(d);
  start.setDate(start.getDate() - daysSinceSaturday);
  return start;
};

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1);
const endOfYear = (d: Date) =>
  new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);

type PeriodKey = "today" | "week" | "month" | "year" | "all" | "custom";

const resolveDateRange = (
  period: PeriodKey = "all",
  dateFrom?: string,
  dateTo?: string,
): { start?: Date | undefined; end?: Date | undefined } => {
  const now = new Date();
  switch (period) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "week":
      return { start: startOfWeek(now), end: endOfDay(now) };
    case "month":
      return { start: startOfMonth(now), end: endOfDay(now) };
    case "year":
      return { start: startOfYear(now), end: endOfDay(now) };
    case "custom": {
      const start = dateFrom ? parseTransactionDate(dateFrom) : undefined;
      const end = dateTo ? endOfDay(parseTransactionDate(dateTo)) : undefined;
      if (start && end && start > end) {
        throw createAppError(
          "Start date must be before or equal to end date",
          Status.BAD_REQUEST,
        );
      }
      return { start, end };
    }
    case "all":
    default:
      return {};
  }
};

// ─── Authorization scope ─────────────────────────────────────────────────────

const getAccessibleWorkspaceIds = async (userId: string): Promise<string[]> => {
  const memberships = await prisma.membership.findMany({
    where: { userId, status: MembershipStatus.ACTIVE },
    select: { workspaceId: true },
  });
  return memberships.map((m) => m.workspaceId);
};

/**
 * Authorises a finance action against the TARGET workspace's membership role.
 * The active-workspace role is not enough: in "All Workspaces" mode a user may
 * act on a workspace where their role differs (e.g. OWNER of a personal
 * practice while viewing it from an institution where they are a DOCTOR).
 */
const assertFinancePermission = async (
  userId: string,
  workspaceId: string,
  permissionKey: string,
) => {
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { role: true, status: true },
  });

  if (!membership || membership.status !== MembershipStatus.ACTIVE) {
    throw createAppError(
      "You do not have access to this workspace",
      Status.FORBIDDEN,
    );
  }

  const allowed = await PermissionServices.hasPermission(
    userId,
    membership.role,
    permissionKey,
  );
  if (!allowed) {
    throw createAppError(`Permission denied: ${permissionKey}`, Status.FORBIDDEN);
  }
};

/**
 * Resolves the set of workspace IDs a request may read/write. The client may
 * never supply the list — it is always derived from ACTIVE memberships.
 */
const resolveScopeWorkspaceIds = async (
  userId: string,
  activeWorkspaceId: string,
  scope?: string,
  explicitWorkspaceId?: string,
): Promise<string[]> => {
  const accessible = await getAccessibleWorkspaceIds(userId);

  const target = explicitWorkspaceId || activeWorkspaceId;
  if (explicitWorkspaceId) {
    if (!accessible.includes(explicitWorkspaceId)) {
      throw createAppError(
        "You do not have access to this workspace",
        Status.FORBIDDEN,
      );
    }
    return [explicitWorkspaceId];
  }

  if (scope === "all") {
    if (accessible.length === 0) {
      throw createAppError(
        "You do not have access to any workspace",
        Status.FORBIDDEN,
      );
    }
    return accessible;
  }

  if (!accessible.includes(target)) {
    throw createAppError(
      "You do not have access to this workspace",
      Status.FORBIDDEN,
    );
  }
  return [target];
};

// ─── Categories ──────────────────────────────────────────────────────────────

const resolveCategory = async (
  categoryId: string,
  type: FinancialTransactionType,
  workspaceId: string,
) => {
  const category = await prisma.financialCategory.findUnique({
    where: { id: categoryId },
  });

  if (!category) {
    throw createAppError("Category not found", Status.NOT_FOUND);
  }
  if (!category.isActive) {
    throw createAppError("Category is inactive", Status.BAD_REQUEST);
  }
  if (category.type !== type) {
    throw createAppError(
      `Category "${category.name}" is a ${category.type.toLowerCase()} category and cannot be used for a ${type.toLowerCase()} transaction`,
      Status.BAD_REQUEST,
    );
  }
  // System categories (workspaceId null) are shared; custom ones must belong to
  // the target workspace.
  if (category.workspaceId && category.workspaceId !== workspaceId) {
    throw createAppError(
      "Category does not belong to this workspace",
      Status.BAD_REQUEST,
    );
  }
  return category;
};

const listCategories = async (
  userId: string,
  activeWorkspaceId: string,
  filters: {
    type?: FinancialTransactionType | undefined;
    includeInactive?: boolean | undefined;
  },
) => {
  const accessible = await getAccessibleWorkspaceIds(userId);
  if (!accessible.includes(activeWorkspaceId)) {
    throw createAppError("Workspace access denied", Status.FORBIDDEN);
  }

  return prisma.financialCategory.findMany({
    where: {
      // System categories + this workspace's custom categories.
      OR: [{ workspaceId: null }, { workspaceId: activeWorkspaceId }],
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
};

const createCategory = async (
  userId: string,
  workspaceId: string,
  data: { name: string; type: FinancialTransactionType; description?: string },
  meta?: { ipAddress?: string | undefined; userAgent?: string | undefined },
) => {
  const accessible = await getAccessibleWorkspaceIds(userId);
  if (!accessible.includes(workspaceId)) {
    throw createAppError("Workspace access denied", Status.FORBIDDEN);
  }
  // Category management is a "manage" action, not a day-to-day record action.
  await assertFinancePermission(userId, workspaceId, "finance_update");

  const name = data.name.trim();
  const duplicate = await prisma.financialCategory.findFirst({
    where: { workspaceId, name, type: data.type },
    select: { id: true },
  });
  if (duplicate) {
    throw createAppError(
      "A category with this name already exists",
      Status.CONFLICT,
    );
  }

  const category = await prisma.financialCategory.create({
    data: {
      workspaceId,
      name,
      type: data.type,
      description: data.description ?? null,
      isSystem: false,
    },
  });

  await AuditService.logAudit({
    userId,
    workspaceId,
    actionType: AuditActionType.CREATE,
    entityType: AuditEntityType.FINANCIAL_CATEGORY,
    entityId: category.id,
    newValues: {
      name: category.name,
      type: category.type,
      description: category.description,
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return category;
};

const updateCategory = async (
  userId: string,
  workspaceId: string,
  categoryId: string,
  data: { name?: string; description?: string | null; isActive?: boolean },
  meta?: { ipAddress?: string | undefined; userAgent?: string | undefined },
) => {
  const category = await prisma.financialCategory.findUnique({
    where: { id: categoryId },
  });
  if (!category) {
    throw createAppError("Category not found", Status.NOT_FOUND);
  }
  // System categories are read-only; only this workspace's own categories can
  // be edited.
  if (category.workspaceId !== workspaceId) {
    throw createAppError(
      "You can only edit categories created in this workspace",
      Status.FORBIDDEN,
    );
  }
  await assertFinancePermission(userId, workspaceId, "finance_update");

  const updated = await prisma.financialCategory.update({
    where: { id: categoryId },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });

  await AuditService.logAudit({
    userId,
    workspaceId,
    actionType: AuditActionType.UPDATE,
    entityType: AuditEntityType.FINANCIAL_CATEGORY,
    entityId: categoryId,
    oldValues: {
      name: category.name,
      description: category.description,
      isActive: category.isActive,
    },
    newValues: {
      name: updated.name,
      description: updated.description,
      isActive: updated.isActive,
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return updated;
};

const deleteCategory = async (
  userId: string,
  workspaceId: string,
  categoryId: string,
  meta?: { ipAddress?: string | undefined; userAgent?: string | undefined },
) => {
  const category = await prisma.financialCategory.findUnique({
    where: { id: categoryId },
  });
  if (!category) {
    throw createAppError("Category not found", Status.NOT_FOUND);
  }
  if (category.workspaceId !== workspaceId) {
    throw createAppError(
      "You can only delete categories created in this workspace",
      Status.FORBIDDEN,
    );
  }
  await assertFinancePermission(userId, workspaceId, "finance_delete");

  // Never delete a category that historical transactions reference — deactivate
  // instead so the history stays intact.
  const usageCount = await prisma.financialTransaction.count({
    where: { categoryId, isDeleted: false },
  });
  if (usageCount > 0) {
    throw createAppError(
      "This category is used by existing transactions. Deactivate it instead.",
      Status.CONFLICT,
      true,
      "CATEGORY_IN_USE",
    );
  }

  await prisma.financialCategory.delete({ where: { id: categoryId } });

  await AuditService.logAudit({
    userId,
    workspaceId,
    actionType: AuditActionType.DELETE,
    entityType: AuditEntityType.FINANCIAL_CATEGORY,
    entityId: categoryId,
    oldValues: { name: category.name, type: category.type },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });
};

// ─── Transactions ────────────────────────────────────────────────────────────

const assertReferences = async (
  workspaceId: string,
  refs: {
    patientId?: string | null | undefined;
    appointmentId?: string | null | undefined;
    prescriptionId?: string | null | undefined;
  },
) => {
  if (refs.patientId) {
    const patient = await prisma.patient.findFirst({
      where: { id: refs.patientId, workspaceId },
      select: { id: true },
    });
    if (!patient) {
      throw createAppError(
        "Patient does not belong to this workspace",
        Status.BAD_REQUEST,
      );
    }
  }
  if (refs.appointmentId) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: refs.appointmentId, chamber: { workspaceId } },
      select: { id: true },
    });
    if (!appointment) {
      throw createAppError(
        "Appointment does not belong to this workspace",
        Status.BAD_REQUEST,
      );
    }
  }
  if (refs.prescriptionId) {
    const prescription = await prisma.prescription.findFirst({
      where: { id: refs.prescriptionId, workspaceId },
      select: { id: true },
    });
    if (!prescription) {
      throw createAppError(
        "Prescription does not belong to this workspace",
        Status.BAD_REQUEST,
      );
    }
  }
};

const serializeTransaction = (tx: any) => ({
  ...tx,
  amount: Number(tx.amount),
});

const TRANSACTION_INCLUDE = {
  category: { select: { id: true, name: true, type: true } },
  createdBy: { select: { id: true, name: true } },
  workspace: { select: { id: true, name: true } },
  patient: { select: { id: true, name: true } },
  appointment: { select: { id: true, appointmentDate: true } },
  prescription: { select: { id: true, serialNumber: true } },
} as const;

const createTransaction = async (
  userId: string,
  activeWorkspaceId: string,
  data: {
    workspaceId?: string;
    type: FinancialTransactionType;
    amount: string | number;
    categoryId: string;
    paymentMethod: any;
    description?: string;
    notes?: string;
    transactionDate: string;
    patientId?: string;
    appointmentId?: string;
    prescriptionId?: string;
  },
  meta?: { ipAddress?: string | undefined; userAgent?: string | undefined },
) => {
  const workspaceId = data.workspaceId ?? activeWorkspaceId;
  const accessible = await getAccessibleWorkspaceIds(userId);
  if (!accessible.includes(workspaceId)) {
    throw createAppError(
      "You do not have access to this workspace",
      Status.FORBIDDEN,
    );
  }
  await assertFinancePermission(userId, workspaceId, "finance_create");

  const category = await resolveCategory(
    data.categoryId,
    data.type,
    workspaceId,
  );
  await assertReferences(workspaceId, data);

  const tx = await prisma.financialTransaction.create({
    data: {
      workspaceId,
      createdById: userId,
      type: data.type,
      amount: String(data.amount).trim(), // decimal string → Prisma Decimal
      categoryId: category.id,
      paymentMethod: data.paymentMethod,
      description: data.description ?? null,
      notes: data.notes ?? null,
      transactionDate: parseTransactionDate(data.transactionDate),
      patientId: data.patientId ?? null,
      appointmentId: data.appointmentId ?? null,
      prescriptionId: data.prescriptionId ?? null,
    },
    include: TRANSACTION_INCLUDE,
  });

  await AuditService.logAudit({
    userId,
    workspaceId,
    actionType: AuditActionType.CREATE,
    entityType: AuditEntityType.FINANCIAL_TRANSACTION,
    entityId: tx.id,
    newValues: {
      type: tx.type,
      amount: tx.amount.toString(),
      category: tx.category?.name,
      paymentMethod: tx.paymentMethod,
      transactionDate: tx.transactionDate,
      description: tx.description,
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return serializeTransaction(tx);
};

const buildTransactionWhere = (
  workspaceIds: string[],
  filters: {
    type?: FinancialTransactionType | undefined;
    categoryId?: string | undefined;
    paymentMethod?: any;
    start?: Date | undefined;
    end?: Date | undefined;
    search?: string | undefined;
  },
) => {
  const where: any = {
    workspaceId: { in: workspaceIds },
    isDeleted: false,
  };
  if (filters.type) where.type = filters.type;
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.paymentMethod) where.paymentMethod = filters.paymentMethod;
  if (filters.start || filters.end) {
    where.transactionDate = {
      ...(filters.start ? { gte: filters.start } : {}),
      ...(filters.end ? { lte: filters.end } : {}),
    };
  }
  if (filters.search) {
    where.OR = [
      { description: { contains: filters.search, mode: "insensitive" } },
      { notes: { contains: filters.search, mode: "insensitive" } },
      { category: { name: { contains: filters.search, mode: "insensitive" } } },
    ];
  }
  return where;
};

const listTransactions = async (
  userId: string,
  activeWorkspaceId: string,
  query: {
    scope?: string | undefined;
    workspaceId?: string | undefined;
    type?: FinancialTransactionType | undefined;
    categoryId?: string | undefined;
    paymentMethod?: any;
    period?: PeriodKey | undefined;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
    search?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
  },
) => {
  const workspaceIds = await resolveScopeWorkspaceIds(
    userId,
    activeWorkspaceId,
    query.scope,
    query.workspaceId,
  );

  const { start, end } = resolveDateRange(
    query.period ?? (query.dateFrom || query.dateTo ? "custom" : "all"),
    query.dateFrom,
    query.dateTo,
  );

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const where = buildTransactionWhere(workspaceIds, {
    type: query.type,
    categoryId: query.categoryId,
    paymentMethod: query.paymentMethod,
    start,
    end,
    search: query.search,
  });

  const [records, total] = await Promise.all([
    prisma.financialTransaction.findMany({
      where,
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: TRANSACTION_INCLUDE,
    }),
    prisma.financialTransaction.count({ where }),
  ]);

  return {
    records: records.map(serializeTransaction),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

const getTransaction = async (
  userId: string,
  activeWorkspaceId: string,
  transactionId: string,
) => {
  const accessible = await getAccessibleWorkspaceIds(userId);

  const tx = await prisma.financialTransaction.findFirst({
    where: { id: transactionId, isDeleted: false },
    include: TRANSACTION_INCLUDE,
  });

  if (!tx || !accessible.includes(tx.workspaceId)) {
    // Same response whether it is missing or forbidden — avoids leaking IDs.
    throw createAppError("Transaction not found", Status.NOT_FOUND);
  }

  return serializeTransaction(tx);
};

const updateTransaction = async (
  userId: string,
  activeWorkspaceId: string,
  transactionId: string,
  data: {
    type?: FinancialTransactionType;
    amount?: string | number;
    categoryId?: string;
    paymentMethod?: any;
    description?: string | null;
    notes?: string | null;
    transactionDate?: string;
    patientId?: string | null;
    appointmentId?: string | null;
    prescriptionId?: string | null;
  },
  meta?: { ipAddress?: string | undefined; userAgent?: string | undefined },
) => {
  const accessible = await getAccessibleWorkspaceIds(userId);

  const existing = await prisma.financialTransaction.findFirst({
    where: { id: transactionId, isDeleted: false },
  });
  if (!existing || !accessible.includes(existing.workspaceId)) {
    throw createAppError("Transaction not found", Status.NOT_FOUND);
  }
  await assertFinancePermission(
    userId,
    existing.workspaceId,
    "finance_update",
  );

  const type = data.type ?? existing.type;
  const categoryId = data.categoryId ?? existing.categoryId;
  await resolveCategory(categoryId, type, existing.workspaceId);

  await assertReferences(existing.workspaceId, {
    patientId: data.patientId,
    appointmentId: data.appointmentId,
    prescriptionId: data.prescriptionId,
  });

  const updated = await prisma.financialTransaction.update({
    where: { id: transactionId },
    data: {
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.amount !== undefined
        ? { amount: String(data.amount).trim() }
        : {}),
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.paymentMethod !== undefined
        ? { paymentMethod: data.paymentMethod }
        : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.transactionDate !== undefined
        ? { transactionDate: parseTransactionDate(data.transactionDate) }
        : {}),
      ...(data.patientId !== undefined ? { patientId: data.patientId } : {}),
      ...(data.appointmentId !== undefined
        ? { appointmentId: data.appointmentId }
        : {}),
      ...(data.prescriptionId !== undefined
        ? { prescriptionId: data.prescriptionId }
        : {}),
    },
    include: TRANSACTION_INCLUDE,
  });

  await AuditService.logAudit({
    userId,
    workspaceId: existing.workspaceId,
    actionType: AuditActionType.UPDATE,
    entityType: AuditEntityType.FINANCIAL_TRANSACTION,
    entityId: transactionId,
    oldValues: {
      type: existing.type,
      amount: existing.amount.toString(),
      categoryId: existing.categoryId,
      paymentMethod: existing.paymentMethod,
      transactionDate: existing.transactionDate,
      description: existing.description,
    },
    newValues: {
      type: updated.type,
      amount: updated.amount.toString(),
      category: updated.category?.name,
      paymentMethod: updated.paymentMethod,
      transactionDate: updated.transactionDate,
      description: updated.description,
    },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });

  return serializeTransaction(updated);
};

const deleteTransaction = async (
  userId: string,
  activeWorkspaceId: string,
  transactionId: string,
  meta?: { ipAddress?: string | undefined; userAgent?: string | undefined },
) => {
  const accessible = await getAccessibleWorkspaceIds(userId);

  const existing = await prisma.financialTransaction.findFirst({
    where: { id: transactionId, isDeleted: false },
  });
  if (!existing || !accessible.includes(existing.workspaceId)) {
    throw createAppError("Transaction not found", Status.NOT_FOUND);
  }
  await assertFinancePermission(
    userId,
    existing.workspaceId,
    "finance_delete",
  );

  // Soft delete keeps financial history auditable (matches the app's deletion
  // strategy for important records).
  await prisma.financialTransaction.update({
    where: { id: transactionId },
    data: { isDeleted: true, deletedAt: new Date() },
  });

  await AuditService.logAudit({
    userId,
    workspaceId: existing.workspaceId,
    actionType: AuditActionType.DELETE,
    entityType: AuditEntityType.FINANCIAL_TRANSACTION,
    entityId: transactionId,
    oldValues: {
      type: existing.type,
      amount: existing.amount.toString(),
      categoryId: existing.categoryId,
      paymentMethod: existing.paymentMethod,
      transactionDate: existing.transactionDate,
      description: existing.description,
    },
    metadata: { softDeleted: true },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });
};

// ─── Summary / Reports ───────────────────────────────────────────────────────

const sumByType = async (where: any) => {
  const grouped = await prisma.financialTransaction.groupBy({
    by: ["type"],
    where,
    _sum: { amount: true },
    _count: { _all: true },
  });

  const incomeRow = grouped.find(
    (g) => g.type === FinancialTransactionType.INCOME,
  );
  const expenseRow = grouped.find(
    (g) => g.type === FinancialTransactionType.EXPENSE,
  );

  const totalIncome = Number(incomeRow?._sum.amount ?? 0);
  const totalExpense = Number(expenseRow?._sum.amount ?? 0);

  return {
    totalIncome,
    totalExpense,
    netResult: totalIncome - totalExpense,
    incomeCount: incomeRow?._count._all ?? 0,
    expenseCount: expenseRow?._count._all ?? 0,
    transactionCount: (incomeRow?._count._all ?? 0) + (expenseRow?._count._all ?? 0),
  };
};

const getSummary = async (
  userId: string,
  activeWorkspaceId: string,
  query: {
    scope?: string | undefined;
    workspaceId?: string | undefined;
    period?: PeriodKey | undefined;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
  },
) => {
  const workspaceIds = await resolveScopeWorkspaceIds(
    userId,
    activeWorkspaceId,
    query.scope,
    query.workspaceId,
  );
  const { start, end } = resolveDateRange(
    query.period ?? "all",
    query.dateFrom,
    query.dateTo,
  );

  const where = buildTransactionWhere(workspaceIds, { start, end });
  const summary = await sumByType(where);

  return {
    ...summary,
    currency: "BDT",
    period: {
      period: query.period ?? "all",
      start: start ?? null,
      end: end ?? null,
    },
    workspaceCount: workspaceIds.length,
  };
};

const getCategoryBreakdown = async (where: any) => {
  const grouped = await prisma.financialTransaction.groupBy({
    by: ["categoryId", "type"],
    where,
    _sum: { amount: true },
    _count: { _all: true },
  });

  const categoryIds = [...new Set(grouped.map((g) => g.categoryId))];
  const categories = categoryIds.length
    ? await prisma.financialCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true, type: true },
      })
    : [];
  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  const map = (type: FinancialTransactionType) =>
    grouped
      .filter((g) => g.type === type)
      .map((g) => ({
        categoryId: g.categoryId,
        name: nameById.get(g.categoryId) ?? "Uncategorised",
        total: Number(g._sum.amount ?? 0),
        count: g._count._all,
      }))
      .sort((a, b) => b.total - a.total);

  return {
    incomeByCategory: map(FinancialTransactionType.INCOME),
    expenseByCategory: map(FinancialTransactionType.EXPENSE),
  };
};

const getWorkspaceBreakdown = async (where: any) => {
  const grouped = await prisma.financialTransaction.groupBy({
    by: ["workspaceId", "type"],
    where,
    _sum: { amount: true },
  });

  const workspaceIds = [...new Set(grouped.map((g) => g.workspaceId))];
  const workspaces = workspaceIds.length
    ? await prisma.workspace.findMany({
        where: { id: { in: workspaceIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameById = new Map(workspaces.map((w) => [w.id, w.name]));

  const byWorkspace = new Map<
    string,
    { workspaceId: string; workspaceName: string; income: number; expense: number; net: number }
  >();
  for (const g of grouped) {
    const entry = byWorkspace.get(g.workspaceId) ?? {
      workspaceId: g.workspaceId,
      workspaceName: nameById.get(g.workspaceId) ?? "Workspace",
      income: 0,
      expense: 0,
      net: 0,
    };
    if (g.type === FinancialTransactionType.INCOME) {
      entry.income = Number(g._sum.amount ?? 0);
    } else {
      entry.expense = Number(g._sum.amount ?? 0);
    }
    entry.net = entry.income - entry.expense;
    byWorkspace.set(g.workspaceId, entry);
  }

  return [...byWorkspace.values()].sort((a, b) => b.income - a.income);
};

// Chooses a sensible grouping when the caller does not specify one.
const pickGroupBy = (period: PeriodKey, start?: Date, end?: Date) => {
  if (period === "today") return "day" as const;
  if (period === "week") return "day" as const;
  if (period === "month") return "day" as const;
  if (period === "year") return "month" as const;
  if (period === "all") return "month" as const;
  // custom: decide from the range length
  if (start && end) {
    const days = (end.getTime() - start.getTime()) / 86_400_000;
    if (days <= 31) return "day" as const;
    if (days <= 180) return "week" as const;
    if (days <= 730) return "month" as const;
    return "year" as const;
  }
  return "month" as const;
};

const getTimeSeries = async (
  workspaceIds: string[],
  start: Date | undefined,
  end: Date | undefined,
  groupBy: "day" | "week" | "month" | "year",
) => {
  const rows = await prisma.$queryRaw<
    { bucket: string; type: string; total: string }[]
  >(Prisma.sql`
    SELECT to_char(date_trunc(${groupBy}, "transactionDate"), 'YYYY-MM-DD') AS bucket,
           "type"::text AS type,
           COALESCE(SUM("amount"), 0)::text AS total
    FROM "financial_transactions"
    WHERE "isDeleted" = false
      AND "workspaceId" IN (${Prisma.join(workspaceIds)})
      ${start ? Prisma.sql`AND "transactionDate" >= ${start}` : Prisma.empty}
      ${end ? Prisma.sql`AND "transactionDate" <= ${end}` : Prisma.empty}
    GROUP BY bucket, type
    ORDER BY bucket ASC
  `);

  const byBucket = new Map<
    string,
    { bucket: string; income: number; expense: number; net: number }
  >();
  for (const row of rows) {
    const entry = byBucket.get(row.bucket) ?? {
      bucket: row.bucket,
      income: 0,
      expense: 0,
      net: 0,
    };
    if (row.type === FinancialTransactionType.INCOME) {
      entry.income = Number(row.total);
    } else {
      entry.expense = Number(row.total);
    }
    entry.net = entry.income - entry.expense;
    byBucket.set(row.bucket, entry);
  }

  return [...byBucket.values()].sort((a, b) =>
    a.bucket.localeCompare(b.bucket),
  );
};

const getReport = async (
  userId: string,
  activeWorkspaceId: string,
  query: {
    scope?: string | undefined;
    workspaceId?: string | undefined;
    period?: PeriodKey | undefined;
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
    groupBy?: "day" | "week" | "month" | "year" | undefined;
  },
) => {
  const workspaceIds = await resolveScopeWorkspaceIds(
    userId,
    activeWorkspaceId,
    query.scope,
    query.workspaceId,
  );
  const period = query.period ?? "all";
  const { start, end } = resolveDateRange(period, query.dateFrom, query.dateTo);
  const where = buildTransactionWhere(workspaceIds, { start, end });

  const groupBy = query.groupBy ?? pickGroupBy(period, start, end);

  const [summary, categoryBreakdown, timeSeries, workspaceSummary] =
    await Promise.all([
      sumByType(where),
      getCategoryBreakdown(where),
      getTimeSeries(workspaceIds, start, end, groupBy),
      query.scope === "all"
        ? getWorkspaceBreakdown(where)
        : Promise.resolve([]),
    ]);

  return {
    summary,
    ...categoryBreakdown,
    timeSeries,
    workspaceSummary,
    currency: "BDT",
    period: {
      period,
      start: start ?? null,
      end: end ?? null,
      groupBy,
    },
  };
};

export const FinanceServices = {
  getAccessibleWorkspaceIds,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  createTransaction,
  listTransactions,
  getTransaction,
  updateTransaction,
  deleteTransaction,
  getSummary,
  getReport,
};
