import express from "express";
import { DepartmentController } from "./department.controller";
import { auth } from "../../middleware/auth";
import { requireInstitutionEnabled } from "../../middleware/featureAccess";

const router = express.Router();

// All routes require authentication
router.use(auth());

// Departments belong to institutions, which are not part of the current public
// release. Gate is admin-controlled (FeatureFlag), re-enable later.
router.use(requireInstitutionEnabled as any);

/**
 * Create department
 * POST /api/departments
 */
router.post("/", DepartmentController.createDepartment);

/**
 * Get departments for institution
 * GET /api/departments/institution/:institutionId
 */
router.get(
  "/institution/:institutionId",
  DepartmentController.getDepartmentsByInstitution,
);

/**
 * Get department details
 * GET /api/departments/:id
 */
router.get("/:id", DepartmentController.getDepartmentDetails);

/**
 * Update department
 * PUT /api/departments/:id
 */
router.put("/:id", DepartmentController.updateDepartment);

/**
 * Delete department
 * DELETE /api/departments/:id
 */
router.delete("/:id", DepartmentController.deleteDepartment);

export default router;
