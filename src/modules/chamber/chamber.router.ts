import { Router } from "express";
import { ChamberControllers } from "./chamber.controller";
import { ChamberValidation } from "./chamber.validation";
import validateRequest from "../../middleware/validateRequest";
import { authOnly, authWorkspace } from "../../middleware/auth";
import { WorkspaceRole } from "../../../generated/prisma/enums";

const router = Router();

// Require user to be logged in
router.use(authOnly());

// Create chamber (OWNER/DOCTOR in workspace)
router.post(
  "/",
  authWorkspace([WorkspaceRole.OWNER, WorkspaceRole.DOCTOR]) as any,
  validateRequest(ChamberValidation.createChamberSchema),
  ChamberControllers.createChamber,
);

// Get user's chambers (active workspace)
router.get(
  "/my-chambers",
  authWorkspace([]) as any,
  ChamberControllers.getMyChambers,
);

// Get chamber by ID (active workspace)
router.get(
  "/:id",
  authWorkspace([], { resource: "chamber" }) as any,
  ChamberControllers.getChamberById,
);

// Update chamber (chamber owner only)
router.patch(
  "/:id",
  authWorkspace([WorkspaceRole.OWNER], {
    resource: "chamber",
  }) as any,
  validateRequest(ChamberValidation.updateChamberSchema),
  ChamberControllers.updateChamber,
);

// Delete chamber (chamber owner only)
router.delete(
  "/:id",
  authWorkspace([WorkspaceRole.OWNER], {
    resource: "chamber",
  }) as any,
  ChamberControllers.deleteChamber,
);

// Add chamber schedule (chamber owner only)
router.post(
  "/:id/schedules",
  authWorkspace([WorkspaceRole.OWNER], {
    resource: "chamber",
  }) as any,
  validateRequest(ChamberValidation.addScheduleSchema),
  ChamberControllers.addChamberSchedule,
);

// Delete schedule (chamber owner only)
router.delete(
  "/schedules/:scheduleId",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  ChamberControllers.deleteChamberSchedule,
);

// Create appointment (any workspace member)
router.post(
  "/:id/appointments",
  authWorkspace([
    WorkspaceRole.OWNER,
    WorkspaceRole.DOCTOR,
    WorkspaceRole.ASSISTANT,
    WorkspaceRole.MANAGER,
  ]) as any,
  validateRequest(ChamberValidation.createAppointmentSchema),
  ChamberControllers.createAppointment,
);

// Get chamber appointments (chamber owner or doctor)
router.get(
  "/:id/appointments",
  authWorkspace([WorkspaceRole.OWNER, WorkspaceRole.DOCTOR], {
    resource: "chamber",
  }) as any,
  ChamberControllers.getChamberAppointments,
);

export const ChamberRouters = router;
