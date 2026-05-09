import { Router } from "express";
import { DoctorControllers } from "./doctor.controller";
import { DoctorValidation } from "./doctor.validation";
import validateRequest from "../../middleware/validateRequest";
import { auth_middleware } from "../../middleware/auth";
import { UserRole } from "../../../generated/prisma/enums";
import { upload } from "../../config/multer.config";

const router = Router();

router.post(
  "/",
  auth_middleware([UserRole.INSTITUTION]),
  validateRequest(DoctorValidation.AssignDoctorSchema),
  DoctorControllers.assignDoctor,
);

router.get(
  "/profile",
  auth_middleware([UserRole.DOCTOR_PERSONAL, UserRole.DOCTOR_INSTITUTIONAL]),
  DoctorControllers.getDoctorProfile,
);

router.get(
  "/my-doctors",
  auth_middleware([UserRole.INSTITUTION]),
  DoctorControllers.getMyDoctors,
);

router.get(
  "/",
  auth_middleware([UserRole.ADMIN]),
  DoctorControllers.getAllDoctors,
);

router.get(
  "/:id",
  auth_middleware([UserRole.ADMIN, UserRole.INSTITUTION]),
  DoctorControllers.getDoctorProfileById,
);

router.patch(
  "/profile",
  auth_middleware([UserRole.DOCTOR_PERSONAL, UserRole.DOCTOR_INSTITUTIONAL]),
  upload.fields([{ name: "signature", maxCount: 1 }, { name: "image", maxCount: 1 }]),
  validateRequest(DoctorValidation.UpdateDoctorProfileSchema),
  DoctorControllers.updateDoctorProfile,
);

export const DoctorRouters = router;
