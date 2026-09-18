import { Router } from "express";
import { TemplateControllers } from "./template.controller";
import { authWorkspace } from "../../middleware/auth";
import { WorkspaceRole } from "../../../generated/prisma/enums";

const router = Router();

// List templates in the active workspace
router.get(
  "/",
  authWorkspace([
    WorkspaceRole.DOCTOR,
    WorkspaceRole.OWNER,
    WorkspaceRole.ASSISTANT,
    WorkspaceRole.MANAGER,
  ]) as any,
  TemplateControllers.listTemplates,
);

// Create a template
router.post(
  "/",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER]) as any,
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
  TemplateControllers.getTemplate,
);

router.patch(
  "/:id",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER]) as any,
  TemplateControllers.updateTemplate,
);

router.delete(
  "/:id",
  authWorkspace([WorkspaceRole.DOCTOR, WorkspaceRole.OWNER]) as any,
  TemplateControllers.deleteTemplate,
);

export default router;
