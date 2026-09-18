import { Request, Response, NextFunction } from "express";
import { adminService } from "./admin.service";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";

export const adminController = {
  async getUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const users = await adminService.listUsers();
      res.json(users);
    } catch (err) {
      next(err);
    }
  },

  async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params["id"] as string;
      if (!id) {
        throw createAppError("User ID is required", Status.BAD_REQUEST);
      }
      const { systemRole, isActive } = req.body;
      const updated = await adminService.updateUser(id, { systemRole, isActive });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params["id"] as string;
      if (!id) {
        throw createAppError("User ID is required", Status.BAD_REQUEST);
      }
      await adminService.deleteUser(id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  async getPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const plans = await adminService.listPlans();
      res.json(plans);
    } catch (err) {
      next(err);
    }
  },

  async setPlanFeatureLimit(req: Request, res: Response, next: NextFunction) {
    try {
      const variantId = req.params["variantId"] as string;
      const featureId = req.params["featureId"] as string;
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

  async toggleFeatureFlag(req: Request, res: Response, next: NextFunction) {
    try {
      const featureId = req.params["featureId"] as string;
      const { enabled } = req.body;
      const result = await adminService.toggleFeatureFlag(featureId, enabled);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};
