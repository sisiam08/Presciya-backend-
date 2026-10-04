import { Router } from "express";
import { MedicineControllers } from "./medicine.controller";
import { MedicineValidation } from "./medicine.validation";
import validateRequest from "../../middleware/validateRequest";
import { authOnly, authWorkspace } from "../../middleware/auth";
import { requireFeatureAccess } from "../../middleware/featureAccess";
import { WorkspaceRole } from "../../../generated/prisma/enums";

const router = Router();


router.use(
  authOnly(),
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER]) as any,
);



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
