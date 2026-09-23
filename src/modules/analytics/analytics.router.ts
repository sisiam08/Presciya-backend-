import { Router } from "express";
import { AnalyticsControllers } from "./analytics.controller";
import { authOnly, authWorkspace } from "../../middleware/auth";
import { WorkspaceRole } from "../../../generated/prisma/enums";

const router = Router();

// The DASHBOARD SUMMARY is a core surface, not the premium analytics product.
//
// It used to be gated by `requireFeatureAccess("analytics")`. Because the
// standalone Analytics page was removed, that gate ended up guarding the
// post-login home screen: any plan without the `analytics` entitlement (the
// default Free plan, for instance) received a 402 here, and the dashboard
// silently rendered every KPI as 0 even though the workspace had data.
//
// Authorization is unchanged — an authenticated member of the ACTIVE workspace
// with a staff role can read their own workspace's summary, and the scope is
// still derived server-side (never from a client-supplied workspace id).
router.get(
  "/dashboard",
  authOnly(),
  authWorkspace([
    WorkspaceRole.DOCTOR,
    WorkspaceRole.OWNER,
    WorkspaceRole.MANAGER,
  ]) as any,
  AnalyticsControllers.getDashboardAnalytics,
);

export const AnalyticsRouters = router;
