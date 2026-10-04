import { z } from "zod";




export const BD_MOBILE_REGEX = /^01[3-9]\d{8}$/;


const BD_MOBILE_INPUT_REGEX = /^(?:\+?88)?01[3-9][\d\s\-().]*$/;


export const normalizeBangladeshPhone = (value: string): string => {
  const cleaned = String(value ?? "").replace(/[\s\-().]/g, "");
  return cleaned.replace(/^\+?88/, "");
};


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


export const bangladeshPhone = (message: string = BD_PHONE_MESSAGE) =>
  z.string().trim().transform(normalizeBangladeshPhone).refine(
    (v) => BD_MOBILE_REGEX.test(v),
    message,
  );


export const optionalBangladeshPhone = (message: string = BD_PHONE_MESSAGE) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? normalizeBangladeshPhone(v) : undefined))
    .refine((v) => v === undefined || BD_MOBILE_REGEX.test(v), message);
