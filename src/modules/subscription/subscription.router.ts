import { Router } from "express";
import { SubscriptionControllers } from "./subscription.controller";
import { SubscriptionValidation } from "./subscription.validation";
import validateRequest from "../../middleware/validateRequest";
import { authOnly, authWorkspace } from "../../middleware/auth";
import { WorkspaceRole } from "../../../generated/prisma/enums";

const router = Router();

// AUTHENTICATED ENDPOINTS
router.use(authOnly());

// All authenticated users can view available plans and check their own subscription
router.get("/plans", SubscriptionControllers.getAvailablePlans);
router.get(
  "/my-subscription",
  authWorkspace([
    WorkspaceRole.OWNER,
    WorkspaceRole.MANAGER,
    WorkspaceRole.ASSISTANT,
    WorkspaceRole.DOCTOR,
  ]) as any,
  SubscriptionControllers.getMySubscription,
);
router.get(
  "/entitlements",
  authWorkspace([
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MANAGER,
    WorkspaceRole.ASSISTANT,
    WorkspaceRole.DOCTOR,
  ]) as any,
  SubscriptionControllers.getEntitlements,
);
router.get(
  "/billing-history",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  SubscriptionControllers.getBillingHistory,
);

// Only workspace OWNER can manage subscription
router.post(
  "/subscribe",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  validateRequest(SubscriptionValidation.createSubscriptionSchema),
  SubscriptionControllers.createSubscription,
);

router.post(
  "/validate-voucher",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  validateRequest(SubscriptionValidation.applyVoucherSchema),
  SubscriptionControllers.validateVoucher,
);

router.post(
  "/cancel",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  SubscriptionControllers.cancelSubscription,
);

export const SubscriptionRouters = router;
