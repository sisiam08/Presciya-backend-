import { Router } from "express";
import { ChamberControllers } from "./chamber.controller";
import { ChamberValidation } from "./chamber.validation";
import validateRequest from "../../middleware/validateRequest";
import { authOnly, authWorkspace } from "../../middleware/auth";
import { requireFeatureAccess } from "../../middleware/featureAccess";
import { WorkspaceRole } from "../../../generated/prisma/enums";

const router = Router();


router.use(authOnly());


router.post(
  "/",
  authWorkspace([WorkspaceRole.OWNER, WorkspaceRole.DOCTOR]) as any,
  validateRequest(ChamberValidation.createChamberSchema),
  ChamberControllers.createChamber,
);


router.get(
  "/my-chambers",
  authWorkspace([]) as any,
  ChamberControllers.getMyChambers,
);


router.get(
  "/:id",
  authWorkspace([], { resource: "chamber" }) as any,
  ChamberControllers.getChamberById,
);


router.patch(
  "/:id",
  authWorkspace([WorkspaceRole.OWNER], {
    resource: "chamber",
  }) as any,
  validateRequest(ChamberValidation.updateChamberSchema),
  ChamberControllers.updateChamber,
);


router.delete(
  "/:id",
  authWorkspace([WorkspaceRole.OWNER], {
    resource: "chamber",
  }) as any,
  ChamberControllers.deleteChamber,
);


router.post(
  "/:id/schedules",
  authWorkspace([WorkspaceRole.OWNER], {
    resource: "chamber",
  }) as any,
  validateRequest(ChamberValidation.addScheduleSchema),
  ChamberControllers.addChamberSchedule,
);


router.delete(
  "/schedules/:scheduleId",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  ChamberControllers.deleteChamberSchedule,
);




router.post(
  "/:id/appointments",
  authWorkspace([
    WorkspaceRole.OWNER,
    WorkspaceRole.DOCTOR,
    WorkspaceRole.ASSISTANT,
    WorkspaceRole.MANAGER,
  ]) as any,
  requireFeatureAccess("appointments", {
    trackUsage: false,
    incrementBy: 0,
  }) as any,
  validateRequest(ChamberValidation.createAppointmentSchema),
  ChamberControllers.createAppointment,
);


router.get(
  "/:id/appointments",
  authWorkspace([WorkspaceRole.OWNER, WorkspaceRole.DOCTOR], {
    resource: "chamber",
  }) as any,
  ChamberControllers.getChamberAppointments,
);

export const ChamberRouters = router;
