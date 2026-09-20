import { Router } from "express";
import { InstitutionControllers } from "./institution.controller";
import { InstitutionValidation } from "./institution.validation";
import validateRequest from "../../middleware/validateRequest";
import { authWorkspace } from "../../middleware/auth";
import { requireInstitutionEnabled } from "../../middleware/featureAccess";
import { WorkspaceRole } from "../../../generated/prisma/enums";

const router = Router();

// Institution management is not part of the current public release. The gate
// reads the admin-controlled global flag, so it can be switched back on later
// without touching this router. `GET /profile` stays open because the shared
// branding settings tab reads it for every workspace type.
const INSTITUTION_GATE = requireInstitutionEnabled as any;

// Institution management is workspace-scoped. Reads require any active member;
// mutations require the workspace OWNER or ADMIN. Without this, any active
// member (e.g. a DOCTOR) of the institution workspace could edit the
// institution profile/branding or reassign doctors (Section 6.3).
const MEMBER = authWorkspace([
  WorkspaceRole.OWNER,
  WorkspaceRole.ADMIN,
  WorkspaceRole.MANAGER,
  WorkspaceRole.DOCTOR,
  WorkspaceRole.ASSISTANT,
]) as any;
const MANAGER = authWorkspace([
  WorkspaceRole.OWNER,
  WorkspaceRole.ADMIN,
]) as any;

router.post(
  "/profile",
  INSTITUTION_GATE,
  MANAGER,
  validateRequest(InstitutionValidation.createInstitutionSchema),
  InstitutionControllers.createInstitution,
);

router.get("/profile", MEMBER, InstitutionControllers.getInstitutionProfile);

router.patch(
  "/profile",
  INSTITUTION_GATE,
  MANAGER,
  validateRequest(InstitutionValidation.updateInstitutionSchema),
  InstitutionControllers.updateInstitution,
);

router.patch(
  "/branding",
  MANAGER,
  validateRequest(InstitutionValidation.updateBrandingSchema),
  InstitutionControllers.updateBranding,
);

router.post(
  "/departments",
  INSTITUTION_GATE,
  MANAGER,
  validateRequest(InstitutionValidation.createDepartmentSchema),
  InstitutionControllers.createDepartment,
);

router.get(
  "/departments",
  INSTITUTION_GATE,
  MEMBER,
  InstitutionControllers.getDepartments,
);

router.post(
  "/doctors/assign",
  INSTITUTION_GATE,
  MANAGER,
  validateRequest(InstitutionValidation.assignDoctorSchema),
  InstitutionControllers.assignDoctor,
);

router.delete(
  "/doctors/:doctorId",
  INSTITUTION_GATE,
  MANAGER,
  InstitutionControllers.removeDoctor,
);

router.get(
  "/doctors",
  INSTITUTION_GATE,
  MEMBER,
  InstitutionControllers.getAssignedDoctors,
);

export const InstitutionRouters = router;
