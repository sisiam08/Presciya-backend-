import { prisma } from "../../lib/prisma";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import { SubscriptionServices } from "../subscription/subscription.service";
import {
  FeaturePeriod,
  FeatureAccessParams,
  FeatureAccessResult,
} from "../../interface/feature.type";

const checkFeatureAccess = async (
  params: FeatureAccessParams,
): Promise<FeatureAccessResult> => {
  const {
    featureKey,
    userId,
    workspaceId,
    incrementBy = 1,
    period = "daily",
    trackUsage = true,
  } = params;

  const feature = await prisma.feature.findUnique({
    where: { key: featureKey },
  });

  if (!feature) {
    throw createAppError("Feature not found", Status.NOT_FOUND);
  }

  const featureFlag = await prisma.featureFlag.findUnique({
    where: { featureId: feature.id },
  });

  if (featureFlag && !featureFlag.isEnabledGlobally) {
    throw createAppError("Feature is currently disabled", Status.FORBIDDEN);
  }

  const activePlan = await SubscriptionServices.getActivePlan({
    workspaceId,
    userId,
  });

  if (!activePlan) {
    throw createAppError(
      "No active subscription found for this feature",
      Status.PAYMENT_REQUIRED,
    );
  }

  return SubscriptionServices.checkLimit({
    userId,
    workspaceId,
    featureId: feature.id,
    featureKey,
    subscriptionVariantId: activePlan.variant.id,
    incrementBy,
    period,
    trackUsage,
  });
};

export const FeatureServices = {
  checkFeatureAccess,
};
