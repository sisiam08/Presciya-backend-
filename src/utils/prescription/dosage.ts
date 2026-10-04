
export const DOSAGE_POSITIONS = 4;

export const formatDosage = (value?: string | null): string => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const parts = raw.split("+").map((part) => part.trim());
  if (parts.length !== DOSAGE_POSITIONS) return raw;
  if (parts[DOSAGE_POSITIONS - 1] !== "0") return raw;

  
  
  return raw.slice(0, raw.lastIndexOf("+")).trimEnd();
};
