import express from "express";
import { VerificationController } from "./verification.controller";
import { auth, authRole } from "../../middleware/auth";
import { SystemRole } from "../../../generated/prisma/enums";
import { upload } from "../../config/multer.config";

const router = express.Router();

/**
 * Upload verification evidence to private storage (owner only)
 * POST /api/verification/documents
 */
router.post(
  "/documents",
  auth(),
  upload.array("documents", 5),
  VerificationController.uploadDocuments,
);

/**
 * Submit verification request (owner of the profile)
 * POST /api/verification/submit
 */
router.post("/submit", auth(), VerificationController.submitVerificationRequest);

/**
 * Get pending verification requests (super admin only)
 * GET /api/verification/pending
 */
router.get(
  "/pending",
  authRole([SystemRole.SUPER_ADMIN]),
  VerificationController.getPendingRequests,
);

/**
 * Get verification request details (owner or super admin)
 * GET /api/verification/:id
 */
router.get("/:id", auth(), VerificationController.getRequestDetails);

/**
 * Move verification request to under review (super admin only)
 * POST /api/verification/:id/under-review
 */
router.post(
  "/:id/under-review",
  authRole([SystemRole.SUPER_ADMIN]),
  VerificationController.markUnderReview,
);

/**
 * Approve verification request (super admin only)
 * POST /api/verification/:id/approve
 */
router.post(
  "/:id/approve",
  authRole([SystemRole.SUPER_ADMIN]),
  VerificationController.approveRequest,
);

/**
 * Reject verification request (super admin only)
 * POST /api/verification/:id/reject
 */
router.post(
  "/:id/reject",
  authRole([SystemRole.SUPER_ADMIN]),
  VerificationController.rejectRequest,
);

export default router;
