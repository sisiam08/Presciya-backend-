import { ZodObject } from "zod";
import catchAsync from "../utils/catchAsync";
import { NextFunction, Request, Response } from "express";

const validateRequest = (schema: ZodObject) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    if (req.body && req.body.data && typeof req.body.data === "string") {
      try {
        const parsedData = JSON.parse(req.body.data);
        req.body = { ...req.body, ...parsedData };
        delete req.body.data;
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: "Invalid JSON in request body",
        });
      }
    }
    await schema.parseAsync({
      body: req.body,
      cookies: req.cookies,
    });

    next();
  });
};

export default validateRequest;
