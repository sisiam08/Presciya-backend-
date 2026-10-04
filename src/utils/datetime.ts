

export const BD_UTC_OFFSET_MINUTES = 6 * 60;

const MINUTE_MS = 60 * 1000;


export const toBangladeshTime = (date: Date = new Date()): Date =>
  new Date(date.getTime() + BD_UTC_OFFSET_MINUTES * MINUTE_MS);


const fromBangladeshTime = (wallClock: Date): Date =>
  new Date(wallClock.getTime() - BD_UTC_OFFSET_MINUTES * MINUTE_MS);


const bdDateParts = (date: Date) => {
  const bd = toBangladeshTime(date);
  return {
    year: bd.getUTCFullYear(),
    month: bd.getUTCMonth(),
    day: bd.getUTCDate(),
  };
};


export const bangladeshDayStart = (
  year: number,
  month: number,
  day: number,
): Date => fromBangladeshTime(new Date(Date.UTC(year, month - 1, day)));


export const getStartOfDay = (date: Date = new Date()): Date => {
  const { year, month, day } = bdDateParts(date);
  return fromBangladeshTime(new Date(Date.UTC(year, month, day)));
};


export const getStartOfNextDay = (date: Date = new Date()): Date => {
  const { year, month, day } = bdDateParts(date);
  return fromBangladeshTime(new Date(Date.UTC(year, month, day + 1)));
};


export const getStartOfMonth = (date: Date = new Date()): Date => {
  const { year, month } = bdDateParts(date);
  return fromBangladeshTime(new Date(Date.UTC(year, month, 1)));
};


export const getStartOfNextMonth = (date: Date = new Date()): Date => {
  const { year, month } = bdDateParts(date);
  return fromBangladeshTime(new Date(Date.UTC(year, month + 1, 1)));
};


export const getStartOfYear = (date: Date = new Date()): Date => {
  const { year } = bdDateParts(date);
  return fromBangladeshTime(new Date(Date.UTC(year, 0, 1)));
};


export const getStartOfNextYear = (date: Date = new Date()): Date => {
  const { year } = bdDateParts(date);
  return fromBangladeshTime(new Date(Date.UTC(year + 1, 0, 1)));
};


export const getEndOfDay = (date: Date = new Date()): Date =>
  new Date(getStartOfNextDay(date).getTime() - 1);
export const getEndOfMonth = (date: Date = new Date()): Date =>
  new Date(getStartOfNextMonth(date).getTime() - 1);
export const getEndOfYear = (date: Date = new Date()): Date =>
  new Date(getStartOfNextYear(date).getTime() - 1);


export const getDayOfWeek = (date: Date = new Date()): number =>
  toBangladeshTime(date).getUTCDay();
