/**
 * Date helpers for the product's operating timezone.
 *
 * Presciya serves Bangladesh, which is a single fixed offset (UTC+6) with no
 * daylight saving. Every calendar boundary the product reasons about (daily
 * quotas, daily serials, appointment day windows, finance period filters) is
 * computed in Bangladesh time so a "day" matches what a user in Dhaka actually
 * experiences — not the server's timezone (production runs in UTC).
 *
 * All helpers return absolute instants, so they compare directly with the
 * `DateTime` columns (which are stored in UTC).
 */

export const BD_UTC_OFFSET_MINUTES = 6 * 60;

const MINUTE_MS = 60 * 1000;

/** Wall-clock view of an instant in Bangladesh time (read via UTC getters). */
export const toBangladeshTime = (date: Date = new Date()): Date =>
  new Date(date.getTime() + BD_UTC_OFFSET_MINUTES * MINUTE_MS);

/** Converts a Bangladesh wall-clock value back to an absolute instant. */
const fromBangladeshTime = (wallClock: Date): Date =>
  new Date(wallClock.getTime() - BD_UTC_OFFSET_MINUTES * MINUTE_MS);

/** Year / month / day of an instant as seen in Bangladesh. */
const bdDateParts = (date: Date) => {
  const bd = toBangladeshTime(date);
  return {
    year: bd.getUTCFullYear(),
    month: bd.getUTCMonth(),
    day: bd.getUTCDate(),
  };
};

/** Absolute instant for a Bangladesh calendar date (1-based month). */
export const bangladeshDayStart = (
  year: number,
  month: number,
  day: number,
): Date => fromBangladeshTime(new Date(Date.UTC(year, month - 1, day)));

/** Start of the Bangladesh calendar day containing `date`. */
export const getStartOfDay = (date: Date = new Date()): Date => {
  const { year, month, day } = bdDateParts(date);
  return fromBangladeshTime(new Date(Date.UTC(year, month, day)));
};

/** Start of the next Bangladesh calendar day (exclusive upper bound). */
export const getStartOfNextDay = (date: Date = new Date()): Date => {
  const { year, month, day } = bdDateParts(date);
  return fromBangladeshTime(new Date(Date.UTC(year, month, day + 1)));
};

/** Start of the Bangladesh calendar month containing `date`. */
export const getStartOfMonth = (date: Date = new Date()): Date => {
  const { year, month } = bdDateParts(date);
  return fromBangladeshTime(new Date(Date.UTC(year, month, 1)));
};

/** Start of the next Bangladesh calendar month, i.e. end of the current one. */
export const getStartOfNextMonth = (date: Date = new Date()): Date => {
  const { year, month } = bdDateParts(date);
  return fromBangladeshTime(new Date(Date.UTC(year, month + 1, 1)));
};

/** Start of the Bangladesh calendar year containing `date`. */
export const getStartOfYear = (date: Date = new Date()): Date => {
  const { year } = bdDateParts(date);
  return fromBangladeshTime(new Date(Date.UTC(year, 0, 1)));
};

/** Start of the next Bangladesh calendar year. */
export const getStartOfNextYear = (date: Date = new Date()): Date => {
  const { year } = bdDateParts(date);
  return fromBangladeshTime(new Date(Date.UTC(year + 1, 0, 1)));
};

/** Inclusive end-of-period instants (1 ms before the next period starts). */
export const getEndOfDay = (date: Date = new Date()): Date =>
  new Date(getStartOfNextDay(date).getTime() - 1);
export const getEndOfMonth = (date: Date = new Date()): Date =>
  new Date(getStartOfNextMonth(date).getTime() - 1);
export const getEndOfYear = (date: Date = new Date()): Date =>
  new Date(getStartOfNextYear(date).getTime() - 1);

/** Bangladesh weekday (0 = Sunday … 6 = Saturday). */
export const getDayOfWeek = (date: Date = new Date()): number =>
  toBangladeshTime(date).getUTCDay();
