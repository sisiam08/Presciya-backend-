/**
 * Prescription branding configuration helpers.
 *
 * Footer text and watermark are SEPARATE plan entitlements (`custom_branding`
 * and `watermark`), so the entitlement checks need to know which part of a
 * `templateConfig` payload is actually being written. Enforcing on presence
 * rather than on the mere existence of a `templateConfig` object means a save
 * that does not touch branding is never rejected — and a user is never shown a
 * late, generic entitlement error for a control the UI should not have offered.
 */

export interface TemplateConfigLike {
  footerText?: unknown;
  watermarkEnabled?: unknown;
  watermarkText?: unknown;
  watermarkUrl?: unknown;
}

/** True when a value is a non-blank string. */
export const hasText = (value: unknown): boolean =>
  typeof value === "string" && value.trim() !== "";

/** True when the payload actually configures a custom footer. */
export const hasFooterConfig = (
  config: TemplateConfigLike | null | undefined,
): boolean => hasText(config?.footerText);

/** True when the payload actually configures a watermark (text or image). */
export const hasWatermarkConfig = (
  config: TemplateConfigLike | null | undefined,
): boolean =>
  Boolean(config?.watermarkEnabled) ||
  hasText(config?.watermarkText) ||
  hasText(config?.watermarkUrl);
