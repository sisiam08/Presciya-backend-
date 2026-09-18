import { createAppError } from "../errors/appError";
import { Status } from "../errors/httpStatus";

export const requireStringParam = (
  value: string | string[] | undefined,
  paramName: string,
): string => {
  const normalizedValue = Array.isArray(value) ? value[0] : value;

  if (!normalizedValue) {
    throw createAppError(`${paramName} is required`, Status.BAD_REQUEST);
  }

  return normalizedValue;
};
