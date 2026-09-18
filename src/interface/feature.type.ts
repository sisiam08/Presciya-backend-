export type FeaturePeriod = "daily" | "monthly";

export interface FeatureAccessParams {
  featureKey: string;
  userId: string;
  workspaceId: string;
  incrementBy?: number;
  period?: FeaturePeriod;
  trackUsage?: boolean;
}

export interface FeatureAccessResult {
  featureId: string;
  featureKey: string;
  limitValue: number | null;
  used: number;
  remaining: number | null;
}

export interface FeatureAccessOptions {
  incrementBy?: number;
  period?: FeaturePeriod;
  trackUsage?: boolean;
}

export {};
