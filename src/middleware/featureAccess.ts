import { NextFunction, Request, Response } from "express";
import { createAppError } from "../errors/appError";
import { Status } from "../errors/httpStatus";
import {
  FeatureServices,
  INSTITUTION_COMING_SOON_MESSAGE,
  INSTITUTION_FEATURE_KEY,
} from "../modules/feature/feature.service";
import { FeatureAccessOptions, FeaturePeriod } from "../interface/feature.type";

export const requireFeatureAccess = (
  featureKey: string,
  options: FeatureAccessOptions = {},
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const workspaceId = (req as any).workspaceId as string | undefined;

      if (!userId) {
        throw createAppError("Unauthorized", Status.UNAUTHORIZED);
      }

      if (!workspaceId) {
        throw createAppError(
          "Workspace context required for feature access",
          Status.BAD_REQUEST,
        );
      }

      await FeatureServices.checkFeatureAccess({
        featureKey,
        userId,
        workspaceId,
        incrementBy: options.incrementBy ?? 1,
        period: options.period ?? ("daily" as FeaturePeriod),
        trackUsage: options.trackUsage ?? true,
      });

      next();
    } catch (error) {
      next(error);
    }
  };
};


export const requireGlobalFeature = (
  featureKey: string,
  message = "This feature is currently unavailable",
) => {
  return async (_req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!(await FeatureServices.isGloballyEnabled(featureKey))) {
        throw createAppError(message, Status.FORBIDDEN, true, "FEATURE_UNAVAILABLE");
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};


export const requireInstitutionEnabled = requireGlobalFeature(
  INSTITUTION_FEATURE_KEY,
  INSTITUTION_COMING_SOON_MESSAGE,
);
