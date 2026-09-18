import { PrescriptionLanguage } from "../../../generated/prisma/enums";

// Centralised prescription-language dictionary. This is the ONLY place the
// translatable strings live — templates never hardcode translation logic.
//
// Only four parts of a prescription are language-aware:
//   1. Doctor's instructions (section label)
//   2. Advice (section label)
//   3. Next Visit (section label + the "as needed" default)
//   4. Medicine meal-timing labels
// Everything else (names, medicine/generic, strength, dosage numbers, dates,
// IDs, addresses) stays exactly as entered.

export interface PrescriptionLabels {
  instructions: string;
  advice: string;
  nextVisit: string;
  asNeeded: string;
  mealTiming: Record<string, string>;
}

const ENGLISH: PrescriptionLabels = {
  instructions: "Instructions",
  advice: "Advice",
  nextVisit: "Next Visit",
  asNeeded: "As needed",
  mealTiming: {
    BEFORE_MEAL: "Before Meal",
    AFTER_MEAL: "After Meal",
    WITH_MEAL: "With Meal",
    AFTER_FULL_MEAL: "After Full Meal",
    EMPTY_STOMACH: "Empty Stomach",
    ANYTIME: "Anytime",
  },
};

const BANGLA: PrescriptionLabels = {
  instructions: "নির্দেশনা",
  advice: "পরামর্শ",
  nextVisit: "পরবর্তী সাক্ষাৎ",
  asNeeded: "প্রয়োজন অনুযায়ী",
  mealTiming: {
    BEFORE_MEAL: "খাবার আগে",
    AFTER_MEAL: "খাবার পরে",
    WITH_MEAL: "খাবারের সাথে",
    AFTER_FULL_MEAL: "ভরা পেটে",
    EMPTY_STOMACH: "খালি পেটে",
    ANYTIME: "যেকোনো সময়",
  },
};

const DICTIONARIES: Record<string, PrescriptionLabels> = {
  [PrescriptionLanguage.ENGLISH]: ENGLISH,
  [PrescriptionLanguage.BANGLA]: BANGLA,
};

export const getPrescriptionLabels = (
  language?: string | null,
): PrescriptionLabels =>
  DICTIONARIES[language ?? PrescriptionLanguage.ENGLISH] ?? ENGLISH;

export const isBangla = (language?: string | null): boolean =>
  language === PrescriptionLanguage.BANGLA;

export const translateMealTiming = (
  language: string | null | undefined,
  value?: string | null,
): string => {
  if (!value) return "";
  return (
    getPrescriptionLabels(language).mealTiming[value] ??
    String(value).replace(/_/g, " ")
  );
};

// ─── System-generated value localisation ─────────────────────────────────────
// Durations and dates are produced by the system (not typed by the doctor), so
// they are localised to the prescription language. Free text the doctor writes
// is never translated.

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export const toBanglaDigits = (value: string | number): string =>
  String(value).replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);

const BN_MONTHS = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
];

export const formatPrescriptionDate = (
  date: Date,
  language?: string | null,
): string => {
  if (isBangla(language)) {
    const month = BN_MONTHS[date.getMonth()] ?? "";
    return `${toBanglaDigits(date.getDate())} ${month}, ${toBanglaDigits(date.getFullYear())}`;
  }
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const BN_DURATION_UNITS: Record<string, string> = {
  day: "দিন",
  week: "সপ্তাহ",
  month: "মাস",
};

const singularUnit = (unit: string): string =>
  unit.toLowerCase().replace(/s$/, "");

// "4 weeks" -> "৪ সপ্তাহ" (Bangla) / "4 weeks" (English).
export const formatDurationValue = (
  value: number,
  unit: string,
  language?: string | null,
): string => {
  if (isBangla(language)) {
    const bn = BN_DURATION_UNITS[singularUnit(unit)];
    if (bn) return `${toBanglaDigits(value)} ${bn}`;
  }
  const plural = value === 1 ? unit : `${unit}s`;
  return `${value} ${plural}`;
};

// Localise a legacy free-text duration ("7 days" -> "৭ দিন") when possible.
export const localizeDurationText = (
  text: string,
  language?: string | null,
): string => {
  if (!text || !isBangla(language)) return text;
  return text.replace(/(\d+)\s*([A-Za-z]+)/g, (full, num: string, unit: string) => {
    const bn = BN_DURATION_UNITS[singularUnit(unit)];
    return bn ? `${toBanglaDigits(num)} ${bn}` : full;
  });
};
