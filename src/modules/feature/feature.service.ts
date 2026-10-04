import { prisma } from "../../lib/prisma";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import { SubscriptionServices } from "../subscription/subscription.service";
import {
  FeaturePeriod,
  FeatureAccessParams,
  FeatureAccessResult,
} from "../../interface/feature.type";


export const INSTITUTION_FEATURE_KEY = "institution";

export const INSTITUTION_COMING_SOON_MESSAGE =
  "Institution features are currently under development and will be available soon.";


const isGloballyEnabled = async (featureKey: string): Promise<boolean> => {
  const feature = await prisma.feature.findUnique({
    where: { key: featureKey },
    select: { featureFlags: { select: { isEnabledGlobally: true } } },
  });

  const flag = feature?.featureFlags?.[0];
  return flag ? flag.isEnabledGlobally : false;
};

const assertGloballyEnabled = async (featureKey: string, message: string) => {
  if (!(await isGloballyEnabled(featureKey))) {
    throw createAppError(message, Status.FORBIDDEN, true, "FEATURE_UNAVAILABLE");
  }
};


const assertInstitutionEnabled = () =>
  assertGloballyEnabled(INSTITUTION_FEATURE_KEY, INSTITUTION_COMING_SOON_MESSAGE);

const isInstitutionEnabled = () => isGloballyEnabled(INSTITUTION_FEATURE_KEY);

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
      true,
      "SUBSCRIPTION_REQUIRED",
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


const isFeatureAllowed = async (params: {
  userId: string;
  workspaceId: string;
  featureKey: string;
}): Promise<boolean> => {
  try {
    await checkFeatureAccess({
      ...params,
      trackUsage: false,
      incrementBy: 0,
    });
    return true;
  } catch {
    return false;
  }
};

export const FeatureServices = {
  checkFeatureAccess,
  isFeatureAllowed,
  isGloballyEnabled,
  isInstitutionEnabled,
  assertInstitutionEnabled,
};
