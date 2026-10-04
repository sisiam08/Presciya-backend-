import { Router } from "express";
import { TemplateControllers } from "./template.controller";
import { authWorkspace } from "../../middleware/auth";
import { requireFeatureAccess } from "../../middleware/featureAccess";
import { WorkspaceRole } from "../../../generated/prisma/enums";

const router = Router();





const requireTemplates = requireFeatureAccess("prescription_templates", {
  trackUsage: false,
  incrementBy: 0,
}) as any;


router.get(
  "/",
  authWorkspace([
    WorkspaceRole.DOCTOR,
    WorkspaceRole.OWNER,
    WorkspaceRole.ASSISTANT,
    WorkspaceRole.MANAGER,
  ]) as any,
  requireTemplates,
  TemplateControllers.listTemplates,
);


router.post(
  "/",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER]) as any,
  requireTemplates,
  TemplateControllers.createTemplate,
);


router.get(
  "/:id",
  authWorkspace([
    WorkspaceRole.DOCTOR,
    WorkspaceRole.OWNER,
    WorkspaceRole.ASSISTANT,
    WorkspaceRole.MANAGER,
  ]) as any,
  requireTemplates,
  TemplateControllers.getTemplate,
);

router.patch(
  "/:id",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER]) as any,
  requireTemplates,
  TemplateControllers.updateTemplate,
);

router.delete(
  "/:id",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER]) as any,
  requireTemplates,
  TemplateControllers.deleteTemplate,
);

export default router;
