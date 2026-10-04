import express from "express";
import { DepartmentController } from "./department.controller";
import { auth } from "../../middleware/auth";
import { requireInstitutionEnabled } from "../../middleware/featureAccess";

const router = express.Router();


router.use(auth());



router.use(requireInstitutionEnabled as any);


router.post("/", DepartmentController.createDepartment);


router.get(
  "/institution/:institutionId",
  DepartmentController.getDepartmentsByInstitution,
);


router.get("/:id", DepartmentController.getDepartmentDetails);


router.put("/:id", DepartmentController.updateDepartment);


router.delete("/:id", DepartmentController.deleteDepartment);

export default router;
