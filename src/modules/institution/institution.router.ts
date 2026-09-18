import { Router } from "express";
import { InstitutionControllers } from "./institution.controller";
import { InstitutionValidation } from "./institution.validation";
import validateRequest from "../../middleware/validateRequest";
import { authOnly } from "../../middleware/auth";

const router = Router();

// All routes require authentication; workspace-level checks happen in controllers/services
router.use(authOnly());

router.post(
  "/profile",
  validateRequest(InstitutionValidation.createInstitutionSchema),
  InstitutionControllers.createInstitution,
);

router.get("/profile", InstitutionControllers.getInstitutionProfile);

router.patch(
  "/profile",
  validateRequest(InstitutionValidation.updateInstitutionSchema),
  InstitutionControllers.updateInstitution,
);

router.patch(
  "/branding",
  validateRequest(InstitutionValidation.updateBrandingSchema),
  InstitutionControllers.updateBranding,
);

router.post(
  "/departments",
  validateRequest(InstitutionValidation.createDepartmentSchema),
  InstitutionControllers.createDepartment,
);

router.get("/departments", InstitutionControllers.getDepartments);

router.post(
  "/doctors/assign",
  validateRequest(InstitutionValidation.assignDoctorSchema),
  InstitutionControllers.assignDoctor,
);

router.delete("/doctors/:doctorId", InstitutionControllers.removeDoctor);

router.get("/doctors", InstitutionControllers.getAssignedDoctors);

export const InstitutionRouters = router;
