import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "../../generated/prisma/client";

function globalErrorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  let statusCode = err.statusCode || 500;
  let errorMessage = err.message || "Internal server error!";
  let errorDetails = null;

  if (err instanceof ZodError) {
    statusCode = 400;
    errorMessage = "Validation Error";
    errorDetails = err.issues.map(issue => ({
      field: issue.path[issue.path.length - 1],
      message: issue.message
    }));
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    errorMessage = "You provide incorrect field type or missing fields!";
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") {
      statusCode = 404;
      errorMessage = "Records not found!";
    } else if (err.code === "P2003") {
      statusCode = 404;
      errorMessage = "Foreign key constraint failed!";
    } else if (err.code === "P2002") {
      statusCode = 409;
      let fields = "field";
      const target = err.meta?.target;
      if (Array.isArray(target)) {
        fields = target.join(", ");
      } else if (typeof target === "string") {
        fields = target;
      } else {
        const match = err.message.match(/Unique constraint failed on the fields: \(`([^]+)`\)/);
        if (match && match[1]) {
          fields = match[1].replace(/["']/g, "");
        }
      }
      errorMessage = `Duplicate entry! This ${fields} already exists.`;
    }
  } else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    statusCode = 500;
    errorMessage = "Occured wrong query!";
  } else if (err instanceof Prisma.PrismaClientInitializationError) {
    if (err.errorCode === "P1000") {
      statusCode = 401;
      errorMessage =
        "Unauthorized access. Please check your provided credentials!";
    } else if (err.errorCode === "P1008") {
      statusCode = 500;
      errorMessage = "Operations timed out!";
    }
  }

  res.status(statusCode).json({
    success: false,
    message: errorMessage,
    ...(errorDetails && { errors: errorDetails })
  });
}

export default globalErrorHandler;
