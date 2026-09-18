import { Router, Request, Response, NextFunction } from "express";
import { adminService } from "./admin.service";
import { authRole } from "../../middleware/auth";
import { requirePermission } from "../../middleware/permission";
import { SystemRole } from "../../../generated/prisma/enums";

const router = Router();

// Apply admin system-role guard to all routes
router.use(authRole([SystemRole.SUPER_ADMIN]));

// Users management
router.get(
  "/users",
  requirePermission("manage_users"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await adminService.listUsers();
      res.json(users);
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/users/:id",
  requirePermission("manage_users"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const { systemRole, isActive } = req.body;
      const updated = await adminService.updateUser(id, { systemRole, isActive });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/users/:id",
  requirePermission("manage_users"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      await adminService.deleteUser(id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

// Plans and feature limits
router.get(
  "/plans",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plans = await adminService.listPlans();
      res.json(plans);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/plans/:variantId/features/:featureId/limit",
  requirePermission("manage_plans"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { variantId, featureId } = req.params as {
        variantId: string;
        featureId: string;
      };
      const { limitValue } = req.body; // number | null
      const result = await adminService.setPlanFeatureLimit(
        variantId,
        featureId,
        limitValue,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/features/:featureId/flag",
  requirePermission("toggle_features"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { featureId } = req.params as { featureId: string };
      const { enabled } = req.body;
      const result = await adminService.toggleFeatureFlag(featureId, enabled);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// Audit log viewer
router.get(
  "/audit-logs",
  requirePermission("manage_users"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, userId, workspaceId, actionType, entityType } =
        req.query;
      const result = await adminService.listAuditLogs({
        page,
        limit,
        userId: userId as string,
        workspaceId: workspaceId as string,
        actionType: actionType as string,
        entityType: entityType as string,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// Login history viewer
router.get(
  "/login-history",
  requirePermission("manage_users"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, userId, status } = req.query;
      const result = await adminService.listLoginHistory({
        page,
        limit,
        userId: userId as string,
        status: status as string,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// Dashboard statistics
router.get(
  "/stats",
  requirePermission("manage_users"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminService.getDashboardStats();
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// Workspace directory (platform-wide)
router.get(
  "/workspaces",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminService.listWorkspaces();
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// Medicine catalog (platform reference data)
router.get(
  "/medicines",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { q, page, limit } = req.query;
      const result = await adminService.listMedicines({
        q: q as string | undefined,
        page,
        limit,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/medicines",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminService.createMedicine(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
