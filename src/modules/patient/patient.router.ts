import { Router } from "express";
import { PatientControllers } from "./patient.controller";
import { PatientValidation } from "./patient.validation";
import validateRequest from "../../middleware/validateRequest";
import { authOnly, authWorkspace } from "../../middleware/auth";
import { WorkspaceRole } from "../../../generated/prisma/enums";

const router = Router();

// Require user to be logged in
router.use(authOnly());

// Create patient (DOCTOR or OWNER in workspace)
router.post(
  "/",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER]) as any,
  validateRequest(PatientValidation.createPatientSchema),
  PatientControllers.createPatient,
);

// Search patients (DOCTOR or OWNER in workspace)
router.get(
  "/search",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER]) as any,
  PatientControllers.searchPatients,
);

// Get patient by ID with ownership check
router.get(
  "/:id",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER], {
    resource: "patient",
  }) as any,
  PatientControllers.getPatientById,
);

// Update patient (patient owner or OWNER)
router.patch(
  "/:id",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER], {
    resource: "patient",
  }) as any,
  validateRequest(PatientValidation.updatePatientSchema),
  PatientControllers.updatePatient,
);

// Delete patient (patient owner or OWNER)
router.delete(
  "/:id",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER], {
    resource: "patient",
  }) as any,
  PatientControllers.deletePatient,
);

// Get patient timeline (any workspace member)
router.get(
  "/:id/timeline",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER], {
    resource: "patient",
  }) as any,
  PatientControllers.getPatientTimeline,
);

export const PatientRouters = router;
