import { Router } from "express";
import { DoctorControllers } from "./doctor.controller";
import { DoctorValidation } from "./doctor.validation";
import validateRequest from "../../middleware/validateRequest";

const router = Router();

router.post(
  "/",
  validateRequest(DoctorValidation.AssignDoctorSchema),
  DoctorControllers.assignDoctor,
);

router.get("/profile", DoctorControllers.getDoctorProfile);

router.get("/my-doctors", DoctorControllers.getMyDoctors);

router.get("/", DoctorControllers.getAllDoctors);

router.get("/:id", DoctorControllers.getDoctorProfileById);

router.patch(
  "/profile",
  validateRequest(DoctorValidation.UpdateDoctorProfileSchema),
  DoctorControllers.updateDoctorProfile,
);

export const DoctorRouters = router;
