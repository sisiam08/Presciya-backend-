import { Router } from "express";
import { MedicineControllers } from "./medicine.controller";
import { MedicineValidation } from "./medicine.validation";
import validateRequest from "../../middleware/validateRequest";
import { authOnly, authWorkspace } from "../../middleware/auth";
import { requireFeatureAccess } from "../../middleware/featureAccess";
import { WorkspaceRole } from "../../../generated/prisma/enums";

const router = Router();

// Requires user to be logged in as a doctor or owner in active workspace
router.use(
  authOnly(),
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER]) as any,
);

// Search stays open (it powers the prescription medicine autocomplete), but the
// doctor's favourites are a premium feature (admin-configurable per plan).
const requireFavorites = requireFeatureAccess("medicine_favorites", {
  trackUsage: false,
  incrementBy: 0,
}) as any;

router.get("/search", MedicineControllers.searchMedicines);

router.get("/favorites", requireFavorites, MedicineControllers.getDoctorFavorites);

router.post(
  "/favorites",
  requireFavorites,
  validateRequest(MedicineValidation.addFavoriteSchema),
  MedicineControllers.addFavorite,
);

router.delete(
  "/favorites/:medicineId",
  requireFavorites,
  MedicineControllers.removeFavorite,
);

export const MedicineRouters = router;
