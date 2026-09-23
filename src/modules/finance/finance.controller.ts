import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { Status } from "../../errors/httpStatus";
import { requireStringParam } from "../../utils/requestParams";
import { FinanceServices } from "./finance.service";
import { FinancialTransactionType } from "../../../generated/prisma/enums";

const auditMeta = (req: Request) => ({
  ipAddress: req.ip,
  userAgent: req.headers["user-agent"] as string | undefined,
});

// ─── Transactions ────────────────────────────────────────────────────────────
// No `createTransaction` handler: manual transaction creation was removed along
// with the manual income/expense workflow. See finance.router.ts.

const listTransactions = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;

  const result = await FinanceServices.listTransactions(userId, workspaceId, {
    scope: req.query.scope as string | undefined,
    workspaceId: req.query.workspaceId as string | undefined,
    type: req.query.type as FinancialTransactionType | undefined,
    categoryId: req.query.categoryId as string | undefined,
    paymentMethod: req.query.paymentMethod as any,
    period: req.query.period as any,
    dateFrom: req.query.dateFrom as string | undefined,
    dateTo: req.query.dateTo as string | undefined,
    search: req.query.search as string | undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Transactions fetched successfully",
    data: result.records,
    meta: result.meta,
  });
});

const getTransaction = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const id = requireStringParam(req.params.id, "Transaction ID");

  const result = await FinanceServices.getTransaction(userId, workspaceId, id);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Transaction fetched successfully",
    data: result,
  });
});

const updateTransaction = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const id = requireStringParam(req.params.id, "Transaction ID");

  const result = await FinanceServices.updateTransaction(
    userId,
    workspaceId,
    id,
    req.body,
    auditMeta(req),
  );

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Transaction updated successfully",
    data: result,
  });
});

const deleteTransaction = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const id = requireStringParam(req.params.id, "Transaction ID");

  await FinanceServices.deleteTransaction(
    userId,
    workspaceId,
    id,
    auditMeta(req),
  );

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Transaction deleted successfully",
    data: null,
  });
});

// ─── Summary / Reports ───────────────────────────────────────────────────────

const getSummary = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;

  const result = await FinanceServices.getSummary(userId, workspaceId, {
    scope: req.query.scope as string | undefined,
    workspaceId: req.query.workspaceId as string | undefined,
    period: req.query.period as any,
    dateFrom: req.query.dateFrom as string | undefined,
    dateTo: req.query.dateTo as string | undefined,
  });

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Finance summary fetched successfully",
    data: result,
  });
});

const getReport = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;

  const result = await FinanceServices.getReport(userId, workspaceId, {
    scope: req.query.scope as string | undefined,
    workspaceId: req.query.workspaceId as string | undefined,
    period: req.query.period as any,
    dateFrom: req.query.dateFrom as string | undefined,
    dateTo: req.query.dateTo as string | undefined,
    groupBy: req.query.groupBy as any,
  });

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Finance report generated successfully",
    data: result,
  });
});

// ─── Categories ──────────────────────────────────────────────────────────────

const listCategories = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;

  const result = await FinanceServices.listCategories(userId, workspaceId, {
    type: req.query.type as FinancialTransactionType | undefined,
    includeInactive: req.query.includeInactive === "true",
  });

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Categories fetched successfully",
    data: result,
  });
});

const createCategory = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;

  const result = await FinanceServices.createCategory(
    userId,
    workspaceId,
    req.body,
    auditMeta(req),
  );

  sendResponse(res, {
    statusCode: Status.CREATED,
    success: true,
    message: "Category created successfully",
    data: result,
  });
});

const updateCategory = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const id = requireStringParam(req.params.id, "Category ID");

  const result = await FinanceServices.updateCategory(
    userId,
    workspaceId,
    id,
    req.body,
    auditMeta(req),
  );

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Category updated successfully",
    data: result,
  });
});

const deleteCategory = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const id = requireStringParam(req.params.id, "Category ID");

  await FinanceServices.deleteCategory(userId, workspaceId, id, auditMeta(req));

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Category deleted successfully",
    data: null,
  });
});

export const FinanceControllers = {
  listTransactions,
  getTransaction,
  updateTransaction,
  deleteTransaction,
  getSummary,
  getReport,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
