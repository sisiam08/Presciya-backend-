import { Router, Request, Response, NextFunction } from "express";
import { AppointmentController } from "./appointment.controller";
import validateRequest from "../../middleware/validateRequest";
import { AppointmentValidation } from "./appointment.validation";
import { authWorkspace } from "../../middleware/auth";
import { WorkspaceRole } from "../../../generated/prisma/enums";
import catchAsync from "../../utils/catchAsync";
import { requireFeatureAccess } from "../../middleware/featureAccess";

const router = Router();

// All routes require workspace context
router.post(
  "/:workspaceId",
  authWorkspace([
    WorkspaceRole.OWNER,
    WorkspaceRole.DOCTOR,
    WorkspaceRole.ASSISTANT,
    WorkspaceRole.MANAGER,
  ]) as any,
  requireFeatureAccess("appointments", { period: "daily" }) as any,
  validateRequest(AppointmentValidation.createAppointmentSchema),
  catchAsync((req: Request, res: Response, next: NextFunction) =>
    AppointmentController.create(req, res, next),
  ),
);

router.get(
  "/:workspaceId",
  authWorkspace([]) as any,
  catchAsync((req: Request, res: Response, next: NextFunction) =>
    AppointmentController.list(req, res, next),
  ),
);

router.patch(
  "/:workspaceId/:id/status",
  authWorkspace([WorkspaceRole.OWNER, WorkspaceRole.DOCTOR]) as any,
  validateRequest(AppointmentValidation.updateAppointmentStatusSchema),
  catchAsync((req: Request, res: Response, next: NextFunction) =>
    AppointmentController.updateStatus(req, res, next),
  ),
);

export const AppointmentRouters = router;
