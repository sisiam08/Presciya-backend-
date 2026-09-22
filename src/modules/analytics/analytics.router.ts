import { Router } from "express";
import { AnalyticsControllers } from "./analytics.controller";
import { authOnly, authWorkspace } from "../../middleware/auth";
import { requireFeatureAccess } from "../../middleware/featureAccess";
import { WorkspaceRole } from "../../../generated/prisma/enums";

const router = Router();

// Expose dashboard metrics with workspace auth check. Analytics is a premium
// feature, so it is also entitlement-gated (admin decides which plans include
// it). Pure entitlement check — no usage counting.
router.get(
  "/dashboard",
  authOnly(),
  authWorkspace([
    WorkspaceRole.DOCTOR,
    WorkspaceRole.OWNER,
    WorkspaceRole.MANAGER,
  ]) as any,
  requireFeatureAccess("analytics", {
    trackUsage: false,
    incrementBy: 0,
  }) as any,
  AnalyticsControllers.getDashboardAnalytics,
);

export const AnalyticsRouters = router;
