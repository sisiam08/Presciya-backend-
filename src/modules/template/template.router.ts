import { Router } from "express";
import { TemplateControllers } from "./template.controller";
import { authWorkspace } from "../../middleware/auth";
import { requireFeatureAccess } from "../../middleware/featureAccess";
import { WorkspaceRole } from "../../../generated/prisma/enums";

const router = Router();

// SAVED (reusable) prescription templates have their OWN entitlement,
// `prescription_templates`. This is a different feature from the built-in DESIGN
// templates (`prescription_design_templates`) and from the prescription LANGUAGE
// (`prescription_language`) — they must never unlock one another.
const requireTemplates = requireFeatureAccess("prescription_templates", {
  trackUsage: false,
  incrementBy: 0,
}) as any;

// List templates in the active workspace
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

// Create a template
router.post(
  "/",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER]) as any,
  requireTemplates,
  TemplateControllers.createTemplate,
);

// Get / update / delete a template
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
