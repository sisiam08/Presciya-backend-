import { prisma } from "../../lib/prisma";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import { SubscriptionServices } from "../subscription/subscription.service";
import {
  FeaturePeriod,
  FeatureAccessParams,
  FeatureAccessResult,
} from "../../interface/feature.type";

/**
 * Feature key used as the global availability switch for institution
 * (hospital / clinic) functionality. Its FeatureFlag row gates the whole
 * institution surface, so the code ships disabled and can be switched on
 * later from the admin panel — there is no hardcoded "institution → off".
 */
export const INSTITUTION_FEATURE_KEY = "institution";

export const INSTITUTION_COMING_SOON_MESSAGE =
  "Institution features are currently under development and will be available soon.";

/**
 * Global (non-plan) availability check backed by FeatureFlag.isEnabledGlobally.
 * Used for surfaces that are not tied to a plan entitlement. A missing feature
 * or flag is treated as disabled for these surfaces (fail closed).
 */
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

/** Throws the standard "coming soon" error when institution is unavailable. */
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

export const FeatureServices = {
  checkFeatureAccess,
  isGloballyEnabled,
  isInstitutionEnabled,
  assertInstitutionEnabled,
};
