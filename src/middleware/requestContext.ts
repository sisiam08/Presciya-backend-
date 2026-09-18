import { NextFunction, Request, Response } from "express";
import crypto from "crypto";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Attaches a request id to every request and echoes it back in the
 * X-Request-Id header so a request can be traced across logs (Section 25.4).
 */
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const incoming = req.headers["x-request-id"];
  const id =
    (Array.isArray(incoming) ? incoming[0] : incoming) ||
    crypto.randomUUID();

  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
};

/**
 * Minimal structured access log. Never logs bodies, tokens, query secrets or
 * medical content — only method, path, status, duration and request id.
 */
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
