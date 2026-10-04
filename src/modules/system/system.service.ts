import {
  FeatureServices,
  INSTITUTION_FEATURE_KEY,
} from "../feature/feature.service";


const PUBLIC_AVAILABILITY_KEYS = [INSTITUTION_FEATURE_KEY];


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
