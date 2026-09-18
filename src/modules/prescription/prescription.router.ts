import { Router } from "express";
import { PrescriptionControllers } from "./prescription.controller";
import { PrescriptionValidation } from "./prescription.validation";
import validateRequest from "../../middleware/validateRequest";
import { authOnly, authWorkspace } from "../../middleware/auth";
import { WorkspaceRole } from "../../../generated/prisma/enums";
import { requireFeatureAccess } from "../../middleware/featureAccess";
import { publicVerifyLimiter } from "../../middleware/rateLimiter";

const router = Router();

// PUBLIC/ANONYMOUS ENDPOINTS (For QR Validation and Print view)
router.get("/:id/print", publicVerifyLimiter, PrescriptionControllers.printPrescription);
router.get("/:id/verify", publicVerifyLimiter, PrescriptionControllers.verifyPrescription);

// AUTHENTICATED ENDPOINTS
router.use(authOnly());

// Create prescription (DOCTOR or OWNER in workspace)
router.post(
  "/",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER]) as any,
  requireFeatureAccess("create_prescription", { period: "daily" }) as any,
  validateRequest(PrescriptionValidation.createPrescriptionSchema),
  PrescriptionControllers.createPrescription,
);

// Get workspace prescriptions (any workspace member)
router.get(
  "/my-prescriptions",
  authWorkspace([
    WorkspaceRole.DOCTOR,
    WorkspaceRole.OWNER,
    WorkspaceRole.ASSISTANT,
    WorkspaceRole.MANAGER,
  ]) as any,
  PrescriptionControllers.getMyPrescriptions,
);

// Get prescription by ID (prescription owner or OWNER in workspace)
router.get(
  "/:id",
  authWorkspace(
    [
      WorkspaceRole.DOCTOR,
      WorkspaceRole.OWNER,
      WorkspaceRole.ASSISTANT,
      WorkspaceRole.MANAGER,
    ],
    { resource: "prescription" },
  ) as any,
  PrescriptionControllers.getPrescriptionById,
);

// Update prescription (prescription owner or OWNER)
router.patch(
  "/:id",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER], {
    resource: "prescription",
  }) as any,
  validateRequest(PrescriptionValidation.updatePrescriptionSchema),
  PrescriptionControllers.updatePrescription,
);

// Finalize prescription (prescription owner or OWNER)
router.post(
  "/:id/finalize",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER], {
    resource: "prescription",
  }) as any,
  PrescriptionControllers.finalizePrescription,
);

// Delete prescription (prescription owner or OWNER)
router.delete(
  "/:id",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER], {
    resource: "prescription",
  }) as any,
  PrescriptionControllers.deletePrescription,
);

export const PrescriptionRouters = router;
