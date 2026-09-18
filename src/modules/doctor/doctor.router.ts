import { Router } from "express";
import { DoctorControllers } from "./doctor.controller";
import { DoctorValidation } from "./doctor.validation";
import validateRequest from "../../middleware/validateRequest";
import { authWorkspace, authOnly } from "../../middleware/auth";
import { WorkspaceRole } from "../../../generated/prisma/enums";
import { upload } from "../../config/multer.config";

const router = Router();

// Assign doctor to workspace (OWNER only)
router.post(
  "/",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  validateRequest(DoctorValidation.AssignDoctorSchema),
  DoctorControllers.assignDoctor,
);

// Get own doctor profile (any authenticated user)
router.get("/profile", authOnly(), DoctorControllers.getDoctorProfile);

// Get workspace doctors (OWNER only)
router.get(
  "/my-doctors",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  DoctorControllers.getMyDoctors,
);

// Get all doctors (requires OWNER - platform level)
router.get(
  "/",
  authWorkspace([WorkspaceRole.OWNER]) as any,
  DoctorControllers.getAllDoctors,
);

// Get doctor by ID (OWNER/DOCTOR in same workspace)
router.get(
  "/:id",
  authWorkspace([WorkspaceRole.OWNER, WorkspaceRole.DOCTOR]) as any,
  DoctorControllers.getDoctorProfileById,
);

// Update own doctor profile (any authenticated user)
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
