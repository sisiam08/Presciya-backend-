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
