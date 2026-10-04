import { Router } from "express";
import { PatientControllers } from "./patient.controller";
import { PatientValidation } from "./patient.validation";
import validateRequest from "../../middleware/validateRequest";
import { authOnly, authWorkspace } from "../../middleware/auth";
import { WorkspaceRole } from "../../../generated/prisma/enums";

const router = Router();


router.use(authOnly());


router.post(
  "/",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER]) as any,
  validateRequest(PatientValidation.createPatientSchema),
  PatientControllers.createPatient,
);


router.get(
  "/search",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER]) as any,
  PatientControllers.searchPatients,
);


router.get(
  "/:id",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER], {
    resource: "patient",
  }) as any,
  PatientControllers.getPatientById,
);


router.patch(
  "/:id",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER], {
    resource: "patient",
  }) as any,
  validateRequest(PatientValidation.updatePatientSchema),
  PatientControllers.updatePatient,
);


router.delete(
  "/:id",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER], {
    resource: "patient",
  }) as any,
  PatientControllers.deletePatient,
);


router.get(
  "/:id/timeline",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER], {
    resource: "patient",
  }) as any,
  PatientControllers.getPatientTimeline,
);

export const PatientRouters = router;
