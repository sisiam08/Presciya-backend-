import { Router } from "express";
import { DoctorControllers } from "./doctor.controller";
import { DoctorValidation } from "./doctor.validation";
import validateRequest from "../../middleware/validateRequest";
import { authWorkspace, authOnly } from "../../middleware/auth";
import { WorkspaceRole } from "../../../generated/prisma/enums";
import { upload } from "../../config/multer.config";

const router = Router();


router.post(
  "/",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  validateRequest(DoctorValidation.AssignDoctorSchema),
  DoctorControllers.assignDoctor,
);


router.get("/profile", authOnly(), DoctorControllers.getDoctorProfile);


router.get(
  "/my-doctors",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  DoctorControllers.getMyDoctors,
);


router.get(
  "/",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  DoctorControllers.getAllDoctors,
);


router.get(
  "/:id",
  authWorkspace([WorkspaceRole.OWNER, WorkspaceRole.DOCTOR]) as any,
  DoctorControllers.getDoctorProfileById,
);


router.patch(
  "/profile",
  authOnly(),
  upload.fields([
    { name: "signature", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  validateRequest(DoctorValidation.UpdateDoctorProfileSchema),
  DoctorControllers.updateDoctorProfile,
);

export const DoctorRouters = router;
