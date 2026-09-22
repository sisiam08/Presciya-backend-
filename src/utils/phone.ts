import { z } from "zod";

/**
 * Central Bangladesh mobile-number rules. Every phone field in the app must go
 * through this module — never scatter phone regexes through the codebase.
 *
 * Canonical domestic form: 01[3-9]XXXXXXXX (exactly 11 digits).
 * International input (+8801… / 8801…) and light formatting (spaces, dashes,
 * dots, parentheses) are accepted and normalised before storage.
 */

/** Canonical domestic number (already normalised). */
export const BD_MOBILE_REGEX = /^01[3-9]\d{8}$/;

/** Input form: optional country code + separators are allowed. */
const BD_MOBILE_INPUT_REGEX = /^(?:\+?88)?01[3-9][\d\s\-().]*$/;

/** Strips separators and the +88 / 88 country prefix. */
export const normalizeBangladeshPhone = (value: string): string => {
  const cleaned = String(value ?? "").replace(/[\s\-().]/g, "");
  return cleaned.replace(/^\+?88/, "");
};

/** True when the value is a valid BD mobile (in any accepted input form). */
export const isValidBangladeshPhone = (value: string): boolean => {
  const raw = String(value ?? "").trim();
  if (!raw) return false;
  return (
    BD_MOBILE_INPUT_REGEX.test(raw) &&
    BD_MOBILE_REGEX.test(normalizeBangladeshPhone(raw))
  );
};

export const BD_PHONE_MESSAGE =
  "Enter a valid Bangladesh mobile number (e.g. 01712345678).";

/**
 * Zod field for a required BD phone. The parsed value is the NORMALISED number,
 * so callers that persist the parse result store the canonical form.
 */
export const bangladeshPhone = (message: string = BD_PHONE_MESSAGE) =>
  z.string().trim().transform(normalizeBangladeshPhone).refine(
    (v) => BD_MOBILE_REGEX.test(v),
    message,
  );

/** Optional variant — an empty value stays allowed, a value must be valid. */
export const optionalBangladeshPhone = (message: string = BD_PHONE_MESSAGE) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? normalizeBangladeshPhone(v) : undefined))
    .refine((v) => v === undefined || BD_MOBILE_REGEX.test(v), message);
