import express from "express";
import { VerificationController } from "./verification.controller";
import { auth } from "../../middleware/auth";

const router = express.Router();

// All routes require authentication
router.use(auth());

/**
 * Submit verification request
 * POST /api/verification/submit
 */
router.post("/submit", VerificationController.submitVerificationRequest);

/**
 * Get pending verification requests (admin only)
 * GET /api/verification/pending
 */
router.get("/pending", VerificationController.getPendingRequests);

/**
 * Get verification request details
 * GET /api/verification/:id
 */
router.get("/:id", VerificationController.getRequestDetails);

/**
 * Move verification request to under review (admin only)
 * POST /api/verification/:id/under-review
 */
router.post(
  "/:id/under-review",
  VerificationController.markUnderReview,
);

/**
 * Approve verification request (admin only)
 * POST /api/verification/:id/approve
 */
router.post("/:id/approve", VerificationController.approveRequest);

/**
 * Reject verification request (admin only)
 * POST /api/verification/:id/reject
 */
router.post("/:id/reject", VerificationController.rejectRequest);

export default router;
