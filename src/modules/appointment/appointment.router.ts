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

// Create an appointment / follow-up visit (premium feature).
router.post(
  "/:workspaceId",
  authWorkspace(STAFF) as any,
  // Entitlement only — the daily limit is enforced in the service by counting
  // the doctor's appointments for the day across all workspaces.
  requireFeatureAccess("appointments", {
    trackUsage: false,
    incrementBy: 0,
  }) as any,
  validateRequest(AppointmentValidation.createAppointmentSchema),
  AppointmentController.create,
);

// List appointments for the workspace.
router.get(
  "/:workspaceId",
  authWorkspace([]) as any,
  AppointmentController.list,
);

// Today's queue (serial / phone / name search).
router.get(
  "/:workspaceId/search/today",
  authWorkspace([]) as any,
  validateRequest(AppointmentValidation.searchAppointmentsSchema),
  AppointmentController.searchToday,
);

// Record payment / discount / free consultation.
router.post(
  "/:workspaceId/:id/payment",
  authWorkspace(STAFF) as any,
  validateRequest(AppointmentValidation.recordPaymentSchema),
  AppointmentController.recordPayment,
);

// Single appointment details.
router.get(
  "/:workspaceId/:id",
  authWorkspace([]) as any,
  AppointmentController.getOne,
);

// Update appointment lifecycle status.
router.patch(
  "/:workspaceId/:id/status",
  authWorkspace(STAFF) as any,
  validateRequest(AppointmentValidation.updateAppointmentStatusSchema),
  AppointmentController.updateStatus,
);

export const AppointmentRouters = router;
