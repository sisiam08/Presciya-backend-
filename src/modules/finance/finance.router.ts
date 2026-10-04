import { Router } from "express";
import { FinanceControllers } from "./finance.controller";
import { FinanceValidation } from "./finance.validation";
import validateRequest from "../../middleware/validateRequest";
import { authWorkspace } from "../../middleware/auth";
import { requirePermission } from "../../middleware/workspace";
import { requireFeatureAccess } from "../../middleware/featureAccess";

const router = Router();






router.use(authWorkspace() as any);




const requireFinanceFeature = requireFeatureAccess("finance", {
  trackUsage: false,
  incrementBy: 0,
});







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
  requireFinanceFeature as any,
  validateRequest(FinanceValidation.updateTransactionSchema),
  FinanceControllers.updateTransaction,
);

router.delete(
  "/transactions/:id",
  requireFinanceFeature as any,
  FinanceControllers.deleteTransaction,
);


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


router.get(
  "/categories",
  requirePermission("finance_view"),
  validateRequest(FinanceValidation.listCategoriesSchema),
  FinanceControllers.listCategories,
);

router.post(
  "/categories",
  requireFinanceFeature as any,
  validateRequest(FinanceValidation.createCategorySchema),
  FinanceControllers.createCategory,
);

router.patch(
  "/categories/:id",
  requireFinanceFeature as any,
  validateRequest(FinanceValidation.updateCategorySchema),
  FinanceControllers.updateCategory,
);

router.delete(
  "/categories/:id",
  requireFinanceFeature as any,
  FinanceControllers.deleteCategory,
);

export const FinanceRouters = router;
