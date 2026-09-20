import express from "express";
import { InstitutionDoctorController } from "./institution-doctor.controller";
import { auth } from "../../middleware/auth";
import { requireInstitutionEnabled } from "../../middleware/featureAccess";

const router = express.Router();

// All routes require authentication
router.use(auth());

// Institution functionality is not part of the current public release. The
// gate is admin-controlled (FeatureFlag), so this can be re-enabled later.
router.use(requireInstitutionEnabled as any);

/**
 * Doctor assignment creation is owned by a single endpoint:
 *   POST /api/v1/institution/doctors/assign
 *
 * This module is the detail/management surface for assignments that already
 * exist (get one, change department/active flag, remove). Do not add a second
 * assignment-creation path here — that would reintroduce the duplication
 * described in Section 10.3 of the design documentation.
 */

/**
 * Get doctors in institution
 * GET /api/institution-doctors/list/:institutionId
 */
router.get(
  "/list/:institutionId",
  InstitutionDoctorController.getInstitutionDoctors,
);

/**
 * Get assignment details
 * GET /api/institution-doctors/:id
 */
router.get("/:id", InstitutionDoctorController.getInstitutionDoctorDetails);

/**
 * Update assignment (department or status)
 * PUT /api/institution-doctors/:id
 */
router.put("/:id", InstitutionDoctorController.updateDoctorAssignment);

/**
 * Remove doctor from institution
 * DELETE /api/institution-doctors/:id
 */
router.delete("/:id", InstitutionDoctorController.removeDoctorFromInstitution);

export default router;
