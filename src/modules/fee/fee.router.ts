import { Router } from "express";
import { FeeControllers } from "./fee.controller";
import { FeeValidation } from "./fee.validation";
import validateRequest from "../../middleware/validateRequest";
import { authWorkspace } from "../../middleware/auth";
import { requireFeatureAccess } from "../../middleware/featureAccess";

const router = Router();

// Any authenticated member may read fees; only the doctor themself can set
// their own fee (enforced in the service via the caller's doctor profile).
router.use(authWorkspace() as any);

// Setting fees is a premium feature (entitlement only, no usage counting).
const requireFeeFeature = requireFeatureAccess("visiting_fees", {
  trackUsage: false,
  incrementBy: 0,
});

router.get("/me", FeeControllers.getMyFee);
router.put(
  "/me",
  requireFeeFeature as any,
  validateRequest(FeeValidation.upsertFeeSchema),
  FeeControllers.upsertMyFee,
);
router.get("/doctor/:doctorId", FeeControllers.getDoctorFee);

export const FeeRouters = router;
