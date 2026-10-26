import { Router, Request, Response, NextFunction } from "express";
import { adminService } from "./admin.service";
import { authRole } from "../../middleware/auth";
import { requirePermission } from "../../middleware/permission";
import { SystemRole } from "../../../generated/prisma/enums";
import { uploadCsv } from "../../config/multer.config";
import sendResponse from "../../utils/sendResponse";
import { Status } from "../../errors/httpStatus";

const router = Router();


router.use(authRole([SystemRole.SUPER_ADMIN]));


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
      const result = await adminService.deleteUser(id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);


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
  "/plans",
  requirePermission("manage_plans"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await adminService.createPlan(req.body);
      res.status(201).json(plan);
    } catch (err) {
      next(err);
    }
  },
);



router.patch(
  "/plans/:variantId",
  requirePermission("manage_plans"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { variantId } = req.params as { variantId: string };
      const plan = await adminService.updatePlan(variantId, req.body);
      res.json(plan);
    } catch (err) {
      next(err);
    }
  },
);


router.get(
  "/features",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const features = await adminService.listFeatures();
      res.json(features);
    } catch (err) {
      next(err);
    }
  },
);


router.put(
  "/plans/:variantId/features/:featureId",
  requirePermission("manage_plans"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { variantId, featureId } = req.params as {
        variantId: string;
        featureId: string;
      };
      const { enabled, limitValue } = req.body;
      const result = await adminService.setPlanFeature(
        variantId,
        featureId,
        Boolean(enabled),
        limitValue ?? null,
      );
      res.json(result);
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
      const { limitValue } = req.body; 
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

// ── CSV Import ──────────────────────────────────────────────────────────────
router.post(
  "/medicines/import",
  uploadCsv.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(Status.BAD_REQUEST).json({
          success: false,
          message: "No file uploaded. Please attach a CSV file with field name \"file\".",
        });
      }
      // Enforce CSV extension on the backend regardless of MIME
      if (!req.file.originalname.toLowerCase().endsWith(".csv")) {
        return res.status(Status.BAD_REQUEST).json({
          success: false,
          message: "Uploaded file must have a .csv extension.",
        });
      }

      const onDuplicate =
        (req.query.on_duplicate as string) === "update" ? "update" : "skip";

      const result = await adminService.importMedicinesFromCsv(
        req.file.buffer,
        onDuplicate,
      );

      sendResponse(res, {
        statusCode: Status.OK,
        success: true,
        message: result.message,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── Delete medicine ─────────────────────────────────────────────────────────
router.delete(
  "/medicines/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      // Safety: refuse to delete if referenced by any prescription medicine
      const refCount = await (await import("../../lib/prisma")).prisma.prescriptionMedicine.count({
        where: { medicineId: id },
      });
      if (refCount > 0) {
        return res.status(Status.CONFLICT).json({
          success: false,
          message: `Cannot delete: this medicine is referenced by ${refCount} prescription(s). Consider keeping it for historical integrity.`,
          data: { referenceCount: refCount },
        });
      }
      await (await import("../../lib/prisma")).prisma.medicine.delete({ where: { id } });
      sendResponse(res, {
        statusCode: Status.OK,
        success: true,
        message: "Medicine deleted successfully.",
        data: { id },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
