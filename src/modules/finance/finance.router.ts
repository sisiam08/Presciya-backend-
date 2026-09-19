import { Router } from "express";
import { FinanceControllers } from "./finance.controller";
import { FinanceValidation } from "./finance.validation";
import validateRequest from "../../middleware/validateRequest";
import { authWorkspace } from "../../middleware/auth";
import { requirePermission } from "../../middleware/workspace";

const router = Router();

// Every finance route requires authentication + an ACTIVE workspace membership.
// Workspace scope is re-derived server-side from memberships — never from the
// client. Write operations are authorised inside the service against the
// TARGET workspace's membership role (the active-workspace role is not enough
// in "All Workspaces" mode); read operations are gated by the active role here.
router.use(authWorkspace() as any);

// ── Transactions ─────────────────────────────────────────────────────────────
router.post(
  "/transactions",
  validateRequest(FinanceValidation.createTransactionSchema),
  FinanceControllers.createTransaction,
);

router.get(
  "/transactions",
  requirePermission("finance_view"),
  validateRequest(FinanceValidation.listTransactionsSchema),
  FinanceControllers.listTransactions,
);

router.get(
  "/transactions/:id",
  requirePermission("finance_view"),
  FinanceControllers.getTransaction,
);

router.patch(
  "/transactions/:id",
  validateRequest(FinanceValidation.updateTransactionSchema),
  FinanceControllers.updateTransaction,
);

router.delete("/transactions/:id", FinanceControllers.deleteTransaction);

// ── Summary & reports ────────────────────────────────────────────────────────
router.get(
  "/summary",
  requirePermission("finance_view"),
  validateRequest(FinanceValidation.summaryQuerySchema),
  FinanceControllers.getSummary,
);

router.get(
  "/reports",
  requirePermission("finance_report_view"),
  validateRequest(FinanceValidation.reportQuerySchema),
  FinanceControllers.getReport,
);

// ── Categories ───────────────────────────────────────────────────────────────
router.get(
  "/categories",
  requirePermission("finance_view"),
  validateRequest(FinanceValidation.listCategoriesSchema),
  FinanceControllers.listCategories,
);

router.post(
  "/categories",
  validateRequest(FinanceValidation.createCategorySchema),
  FinanceControllers.createCategory,
);

router.patch(
  "/categories/:id",
  validateRequest(FinanceValidation.updateCategorySchema),
  FinanceControllers.updateCategory,
);

router.delete("/categories/:id", FinanceControllers.deleteCategory);

export const FinanceRouters = router;
