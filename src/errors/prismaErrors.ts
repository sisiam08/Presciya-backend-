import { Prisma } from "../../generated/prisma/client";
import { IErrorSource } from "../interface";
import { Status } from "./httpStatus";

export const handlePrismaError = (
  err: Prisma.PrismaClientKnownRequestError,
) => {
  let statusCode: number = Status.BAD_REQUEST;
  let message = "Database request error";
  let errorSource: IErrorSource[] = [];

  // P2002: Unique constraint violation
  if (err.code === "P2002") {
    statusCode = Status.CONFLICT;
    message = "Unique constraint violation";
    const target = (err.meta?.target as string[]) || [];
    errorSource = [
      {
        path: target.join("."),
        message: `${target.join(", ")} already exists`,
      },
    ];
  }
  // P2025: Record not found
  else if (err.code === "P2025") {
    statusCode = Status.NOT_FOUND;
    message = "Record not found";
    errorSource = [
      {
        path: "database",
        message: err.message,
      },
    ];
  }
  // Other known errors
  else {
    errorSource = [
      {
        path: "database",
        message: err.message,
      },
    ];
  }

  return {
    statusCode,
    message,
    errorSource,
  };
};

export const handlePrismaValidationError = (
  err: Prisma.PrismaClientValidationError,
) => {
  const statusCode = Status.BAD_REQUEST;
  const message = "Validation error";
  const errorSource: IErrorSource[] = [];

  // Extract specific error messages from Prisma validation error
  // Prisma validation errors contain detailed field-level information
  const errorMessage = err.message;

  // Try to extract field names and error messages from the Prisma error message
  // Pattern: "Unknown argument `fieldName`" or related validation issues
  const fieldMatches = errorMessage.match(
    /Unknown argument `([^`]+)`|Argument `([^`]+)`|Field name `([^`]+)`/g,
  );

  if (fieldMatches && fieldMatches.length > 0) {
    // Extract field names from matches and create error sources
    fieldMatches.forEach((match) => {
      const fieldName = match.match(/`([^`]+)`/)?.[1];
      if (fieldName) {
        errorSource.push({
          path: fieldName,
          message: `Invalid or unknown field`,
        });
      }
    });
  } else {
    // If no specific field errors detected, use generic validation error
    errorSource.push({
      path: "validation",
      message: errorMessage,
    });
  }

  return {
    statusCode,
    message,
    errorSource,
  };
};

export const handlePrismaInitializationError = (
  err: Prisma.PrismaClientInitializationError,
) => {
  const statusCode = Status.INTERNAL_SERVER_ERROR;
  const message = "Database initialization error";
  const errorSource: IErrorSource[] = [
    {
      path: "database",
      message: err.message,
    },
  ];

  return {
    statusCode,
    message,
    errorSource,
  };
};
