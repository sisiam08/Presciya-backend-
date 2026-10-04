import { Router } from "express";
import { InstitutionControllers } from "./institution.controller";
import { InstitutionValidation } from "./institution.validation";
import validateRequest from "../../middleware/validateRequest";
import { authWorkspace } from "../../middleware/auth";
import {
  requireFeatureAccess,
  requireInstitutionEnabled,
} from "../../middleware/featureAccess";
import { WorkspaceRole } from "../../../generated/prisma/enums";

const router = Router();





const INSTITUTION_GATE = requireInstitutionEnabled as any;





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
  
  requireFeatureAccess("custom_branding", {
    trackUsage: false,
    incrementBy: 0,
  }) as any,
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
