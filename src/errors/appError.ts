import { IAppErrorType } from "../interface";

export const createAppError = (
  message: string,
  statusCode: number,
  isOperational: boolean = true,
): IAppErrorType => {
  const error = new Error(message) as IAppErrorType;
  error.statusCode = statusCode;
  error.isOperational = isOperational;

  if (Error.captureStackTrace) {
    Error.captureStackTrace(error, createAppError);
  }

  return error;
};

export const isAppError = (error: unknown): error is IAppErrorType => {
  return (
    error instanceof Error &&
    typeof (error as any).statusCode === "number" &&
    typeof (error as any).isOperational === "boolean"
  );
};
