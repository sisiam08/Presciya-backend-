import { Router } from "express";
import { AnalyticsControllers } from "./analytics.controller";
import { authOnly, authWorkspace } from "../../middleware/auth";
import { WorkspaceRole } from "../../../generated/prisma/enums";

const router = Router();

// Expose dashboard metrics with workspace auth check
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
