import { Router } from "express";
import { AppointmentController } from "./appointment.controller";
import validateRequest from "../../middleware/validateRequest";
import { AppointmentValidation } from "./appointment.validation";
import { authWorkspace } from "../../middleware/auth";
import { WorkspaceRole } from "../../../generated/prisma/enums";
import { requireFeatureAccess } from "../../middleware/featureAccess";

const router = Router();

const STAFF = [
  WorkspaceRole.OWNER,
  WorkspaceRole.ADMIN,
  WorkspaceRole.DOCTOR,
  WorkspaceRole.MANAGER,
  WorkspaceRole.ASSISTANT,
];


router.post(
  "/:workspaceId",
  authWorkspace(STAFF) as any,
  
  
  requireFeatureAccess("appointments", {
    trackUsage: false,
    incrementBy: 0,
  }) as any,
  validateRequest(AppointmentValidation.createAppointmentSchema),
  AppointmentController.create,
);


router.get(
  "/:workspaceId",
  authWorkspace([]) as any,
  AppointmentController.list,
);


router.get(
  "/:workspaceId/search/today",
  authWorkspace([]) as any,
  validateRequest(AppointmentValidation.searchAppointmentsSchema),
  AppointmentController.searchToday,
);


router.post(
  "/:workspaceId/:id/payment",
  authWorkspace(STAFF) as any,
  validateRequest(AppointmentValidation.recordPaymentSchema),
  AppointmentController.recordPayment,
);


router.get(
  "/:workspaceId/:id",
  authWorkspace([]) as any,
  AppointmentController.getOne,
);


router.patch(
  "/:workspaceId/:id/status",
  authWorkspace(STAFF) as any,
  validateRequest(AppointmentValidation.updateAppointmentStatusSchema),
  AppointmentController.updateStatus,
);

export const AppointmentRouters = router;
