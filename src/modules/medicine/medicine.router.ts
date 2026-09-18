import { Router } from "express";
import { MedicineControllers } from "./medicine.controller";
import { MedicineValidation } from "./medicine.validation";
import validateRequest from "../../middleware/validateRequest";
import { authOnly, authWorkspace } from "../../middleware/auth";
import { WorkspaceRole } from "../../../generated/prisma/enums";

const router = Router();

// Requires user to be logged in as a doctor or owner in active workspace
router.use(
  authOnly(),
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER]) as any,
);

router.get("/search", MedicineControllers.searchMedicines);

router.get("/favorites", MedicineControllers.getDoctorFavorites);

router.post(
  "/favorites",
  validateRequest(MedicineValidation.addFavoriteSchema),
  MedicineControllers.addFavorite,
);

router.delete("/favorites/:medicineId", MedicineControllers.removeFavorite);

export const MedicineRouters = router;
