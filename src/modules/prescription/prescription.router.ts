import { Router } from "express";
import { PrescriptionControllers } from "./prescription.controller";
import { PrescriptionValidation } from "./prescription.validation";
import validateRequest from "../../middleware/validateRequest";
import { authOnly, authWorkspace } from "../../middleware/auth";
import { WorkspaceRole } from "../../../generated/prisma/enums";
import { requireFeatureAccess } from "../../middleware/featureAccess";
import { publicVerifyLimiter } from "../../middleware/rateLimiter";

const router = Router();


router.get("/:id/print", publicVerifyLimiter, PrescriptionControllers.printPrescription);
router.get("/:id/verify", publicVerifyLimiter, PrescriptionControllers.verifyPrescription);


router.use(authOnly());


router.post(
  "/",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER]) as any,
  requireFeatureAccess("create_prescription", { period: "daily" }) as any,
  validateRequest(PrescriptionValidation.createPrescriptionSchema),
  PrescriptionControllers.createPrescription,
);


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








router.get(
  "/template-preview",
  authWorkspace([
    WorkspaceRole.DOCTOR,
    WorkspaceRole.OWNER,
    WorkspaceRole.ASSISTANT,
    WorkspaceRole.MANAGER,
  ]) as any,
  requireFeatureAccess("prescription_design_templates", {
    trackUsage: false,
    incrementBy: 0,
  }) as any,
  validateRequest(PrescriptionValidation.previewTemplateSampleSchema),
  PrescriptionControllers.previewTemplateSample,
);


router.get(
  "/:id/preview",
  authWorkspace(
    [
      WorkspaceRole.DOCTOR,
      WorkspaceRole.OWNER,
      WorkspaceRole.ASSISTANT,
      WorkspaceRole.MANAGER,
    ],
    { resource: "prescription" },
  ) as any,
  PrescriptionControllers.previewPrescription,
);


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


router.patch(
  "/:id",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER], {
    resource: "prescription",
  }) as any,
  validateRequest(PrescriptionValidation.updatePrescriptionSchema),
  PrescriptionControllers.updatePrescription,
);


router.post(
  "/:id/finalize",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER], {
    resource: "prescription",
  }) as any,
  PrescriptionControllers.finalizePrescription,
);


router.post(
  "/:id/amend",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER], {
    resource: "prescription",
  }) as any,
  PrescriptionControllers.amendPrescription,
);


router.delete(
  "/:id",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER], {
    resource: "prescription",
  }) as any,
  PrescriptionControllers.deletePrescription,
);

export const PrescriptionRouters = router;
