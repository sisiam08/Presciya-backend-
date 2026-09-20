import {
  FeatureServices,
  INSTITUTION_FEATURE_KEY,
} from "../feature/feature.service";

/**
 * Feature keys whose global availability is safe to expose publicly. These
 * drive the "coming soon" / disabled states in the client. The list is
 * deliberately explicit — adding a key here makes its availability readable by
 * anyone, so only add surfaces that are meant to be publicly gated.
 */
const PUBLIC_AVAILABILITY_KEYS = [INSTITUTION_FEATURE_KEY];

/**
 * Returns `{ [featureKey]: { enabled: boolean } }` for every publicly gated
 * surface, resolved from the FeatureFlag table (admin-controlled).
 */
const getAvailability = async () => {
  const entries = await Promise.all(
    PUBLIC_AVAILABILITY_KEYS.map(
      async (key) =>
        [key, { enabled: await FeatureServices.isGloballyEnabled(key) }] as const,
    ),
  );

  return Object.fromEntries(entries) as Record<string, { enabled: boolean }>;
};

export const SystemServices = {
  getAvailability,
  PUBLIC_AVAILABILITY_KEYS,
};
