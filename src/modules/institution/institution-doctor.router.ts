import express from "express";
import { InstitutionDoctorController } from "./institution-doctor.controller";
import { auth } from "../../middleware/auth";
import { requireInstitutionEnabled } from "../../middleware/featureAccess";

const router = express.Router();


router.use(auth());



router.use(requireInstitutionEnabled as any);




router.get(
  "/list/:institutionId",
  InstitutionDoctorController.getInstitutionDoctors,
);


router.get("/:id", InstitutionDoctorController.getInstitutionDoctorDetails);


router.put("/:id", InstitutionDoctorController.updateDoctorAssignment);


router.delete("/:id", InstitutionDoctorController.removeDoctorFromInstitution);

export default router;
