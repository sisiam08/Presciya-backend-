import { PrescriptionLanguage } from "../../../generated/prisma/enums";

// Centralised prescription-language dictionary. This is the ONLY place the
// translatable strings live — templates never hardcode translation logic.
//
// Product decision: only system-generated VALUES are localised. Field LABELS
// stay English in both languages, and text the doctor types is never translated
// (it is rendered exactly as entered).
//
// Localised values:
//   1. "As needed" — the default when no next-visit date is set
//   2. Medicine meal-timing labels
//   3. Duration values (formatDurationValue / localizeDurationText)
//   4. The next-visit date (formatPrescriptionDate)
//   5. Predefined Special Instruction options (localizeSpecialInstruction)
// Everything else (names, medicine/generic, strength, dosage numbers, dates,
// IDs, addresses, doctor-typed text) stays exactly as entered.

export interface PrescriptionLabels {
  instructions: string;
  advice: string;
  nextVisit: string;
  asNeeded: string;
  mealTiming: Record<string, string>;
}

// Section labels are intentionally NOT translated — they read the same in both
// languages so a bilingual prescription keeps familiar headings.
const FIXED_LABELS = {
  instructions: "Instructions",
  advice: "Advice",
  nextVisit: "Next Visit",
};

const ENGLISH: PrescriptionLabels = {
  ...FIXED_LABELS,
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
  ...FIXED_LABELS,
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

// ─── Predefined "Special Instruction" options ────────────────────────────────
// The medicine card offers these as a picker (plus a free-text "Custom…"
// option). They are system-provided values, so they ARE localised. A custom
// entry is doctor text and is rendered exactly as typed.
//
// NOTE: this list is mirrored on the frontend (SPECIAL_INSTRUCTION_OPTIONS in
// PrescriptionBuilder.tsx) — keep both in sync.

export const SPECIAL_INSTRUCTION_OPTIONS = [
  "Take with plenty of water",
  "Take on an empty stomach",
  "Take with food",
  "Do not take with milk",
  "Complete the full course",
  "Do not crush or chew",
  "Take at bedtime",
  "Avoid alcohol",
  "Shake well before use",
  "Apply thinly to the affected area",
  "For external use only",
  "Keep out of reach of children",
] as const;

const BN_SPECIAL_INSTRUCTIONS: Record<string, string> = {
  "Take with plenty of water": "পর্যাপ্ত পানি দিয়ে সেবন করুন",
  "Take on an empty stomach": "খালি পেটে সেবন করুন",
  "Take with food": "খাবারের সাথে সেবন করুন",
  "Do not take with milk": "দুধের সাথে সেবন করবেন না",
  "Complete the full course": "সম্পূর্ণ কোর্স শেষ করুন",
  "Do not crush or chew": "চূর্ণ বা চিবাবেন না",
  "Take at bedtime": "ঘুমানোর আগে সেবন করুন",
  "Avoid alcohol": "মদ্যপান এড়িয়ে চলুন",
  "Shake well before use": "ব্যবহারের আগে ভালোভাবে ঝাঁকিয়ে নিন",
  "Apply thinly to the affected area": "আক্রান্ত স্থানে পাতলা করে লাগান",
  "For external use only": "শুধুমাত্র বাহ্যিক ব্যবহারের জন্য",
  "Keep out of reach of children": "শিশুদের নাগালের বাইরে রাখুন",
};

/**
 * Localises a predefined Special Instruction. Text the doctor typed themselves
 * (anything not in the predefined list) is returned unchanged.
 */
export const localizeSpecialInstruction = (
  text?: string | null,
  language?: string | null,
): string => {
  if (!text) return "";
  if (!isBangla(language)) return text;
  return BN_SPECIAL_INSTRUCTIONS[text.trim()] ?? text;
};
