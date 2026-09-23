/**
 * Canonical dosage presentation rule — the SINGLE source of truth for every
 * rendered dosage (templates, PDF/print, previews).
 *
 * A dosage pattern has four positions, e.g. "1+1+1+0" (morning+noon+evening+night).
 * The trailing fourth position is only meaningful when it is non-zero, so the
 * LAST position is dropped when — and only when — it is exactly "0".
 *
 *   "1+1+1+0" -> "1+1+1"      "1+0+1+0" -> "1+0+1"
 *   "1+1+0+0" -> "1+1+0"      "1+0+0+0" -> "1+0+0"
 *   "0+0+0+0" -> "0+0+0"      "1+1+1+1" -> "1+1+1+1"
 *
 * Middle/first/second/third zeros are NEVER removed. This is presentation only:
 * the stored and API values are never rewritten.
 */
export const DOSAGE_POSITIONS = 4;

export const formatDosage = (value?: string | null): string => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const parts = raw.split("+").map((part) => part.trim());
  if (parts.length !== DOSAGE_POSITIONS) return raw;
  if (parts[DOSAGE_POSITIONS - 1] !== "0") return raw;

  // Drop only the final position, keeping the earlier positions verbatim
  // (including any internal zeros).
  return raw.slice(0, raw.lastIndexOf("+")).trimEnd();
};
