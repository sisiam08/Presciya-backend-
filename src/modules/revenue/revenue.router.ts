import { Router } from "express";
import { RevenueControllers } from "./revenue.controller";
import { RevenueValidation } from "./revenue.validation";
import validateRequest from "../../middleware/validateRequest";
import { authWorkspace } from "../../middleware/auth";
import { WorkspaceRole } from "../../../generated/prisma/enums";

const router = Router();

// Reads: any active member. Writes: OWNER/ADMIN of the institution workspace
// only. (The service additionally verifies the workspace is an institution.)
router.get(
  "/",
  authWorkspace() as any,
  RevenueControllers.getConfig,
);

router.put(
  "/",
  authWorkspace([WorkspaceRole.OWNER, WorkspaceRole.ADMIN]) as any,
  validateRequest(RevenueValidation.setDefaultSchema),
  RevenueControllers.setDefault,
);

router.put(
  "/doctor/:doctorId",
  authWorkspace([WorkspaceRole.OWNER, WorkspaceRole.ADMIN]) as any,
  validateRequest(RevenueValidation.setOverrideSchema),
  RevenueControllers.setOverride,
);

router.delete(
  "/doctor/:doctorId",
  authWorkspace([WorkspaceRole.OWNER, WorkspaceRole.ADMIN]) as any,
  RevenueControllers.removeOverride,
);

export const RevenueRouters = router;
