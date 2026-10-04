

export interface TemplateConfigLike {
  footerText?: unknown;
  watermarkEnabled?: unknown;
  watermarkText?: unknown;
  watermarkUrl?: unknown;
}


export const hasText = (value: unknown): boolean =>
  typeof value === "string" && value.trim() !== "";


export const hasFooterConfig = (
  config: TemplateConfigLike | null | undefined,
): boolean => hasText(config?.footerText);


export const hasWatermarkConfig = (
  config: TemplateConfigLike | null | undefined,
): boolean =>
  Boolean(config?.watermarkEnabled) ||
  hasText(config?.watermarkText) ||
  hasText(config?.watermarkUrl);
