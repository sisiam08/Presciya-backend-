import express from "express";
import { VerificationController } from "./verification.controller";
import { auth, authRole } from "../../middleware/auth";
import { SystemRole } from "../../../generated/prisma/enums";
import { upload } from "../../config/multer.config";

const router = express.Router();


router.post(
  "/documents",
  auth(),
  upload.array("documents", 5),
  VerificationController.uploadDocuments,
);


router.post("/submit", auth(), VerificationController.submitVerificationRequest);


router.get(
  "/pending",
  authRole([SystemRole.SUPER_ADMIN]),
  VerificationController.getPendingRequests,
);


router.get("/:id", auth(), VerificationController.getRequestDetails);


router.post(
  "/:id/under-review",
  authRole([SystemRole.SUPER_ADMIN]),
  VerificationController.markUnderReview,
);


router.post(
  "/:id/approve",
  authRole([SystemRole.SUPER_ADMIN]),
  VerificationController.approveRequest,
);


router.post(
  "/:id/reject",
  authRole([SystemRole.SUPER_ADMIN]),
  VerificationController.rejectRequest,
);

export default router;
