import { Router } from "express";
import { InstitutionControllers } from "./institution.controller";
import { InstitutionValidation } from "./institution.validation";
import validateRequest from "../../middleware/validateRequest";
import { authWorkspace } from "../../middleware/auth";
import { WorkspaceRole } from "../../../generated/prisma/enums";

const router = Router();

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
  MANAGER,
  validateRequest(InstitutionValidation.createInstitutionSchema),
  InstitutionControllers.createInstitution,
);

router.get("/profile", MEMBER, InstitutionControllers.getInstitutionProfile);

router.patch(
  "/profile",
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
  MANAGER,
  validateRequest(InstitutionValidation.createDepartmentSchema),
  InstitutionControllers.createDepartment,
);

router.get("/departments", MEMBER, InstitutionControllers.getDepartments);

router.post(
  "/doctors/assign",
  MANAGER,
  validateRequest(InstitutionValidation.assignDoctorSchema),
  InstitutionControllers.assignDoctor,
);

router.delete(
  "/doctors/:doctorId",
  MANAGER,
  InstitutionControllers.removeDoctor,
);

router.get("/doctors", MEMBER, InstitutionControllers.getAssignedDoctors);

export const InstitutionRouters = router;
