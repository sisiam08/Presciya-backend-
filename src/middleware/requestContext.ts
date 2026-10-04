import { NextFunction, Request, Response } from "express";
import crypto from "crypto";

declare global {
  
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}


export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const incoming = req.headers["x-request-id"];
  const id =
    (Array.isArray(incoming) ? incoming[0] : incoming) ||
    crypto.randomUUID();

  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
};


export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs =
      Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    const entry = {
      level: res.statusCode >= 500 ? "error" : "info",
      type: "request",
      requestId: req.id,
      method: req.method,
      path: req.originalUrl?.split("?")[0],
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      timestamp: new Date().toISOString(),
    };

    console.log(JSON.stringify(entry));
  });

  next();
};
