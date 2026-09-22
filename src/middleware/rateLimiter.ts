import rateLimit from "express-rate-limit";
import { Status } from "../errors/httpStatus";
import config from "../config";

// CORS preflight requests and health probes must never be rate-limited: a
// blocked preflight breaks the browser's ability to even read the error, and
// health checks should always respond.
const skipPreflight = (req: any) =>
  req.method === "OPTIONS" ||
  (typeof req.originalUrl === "string" &&
    req.originalUrl.startsWith("/api/v1/health"));

const windowMinutes = Math.round(config.rateLimit.windowMs / 60000);
const common = {
  windowMs: config.rateLimit.windowMs,
  skip: skipPreflight,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
};

// General API limiter (RATE_LIMIT_WINDOW_MS / GENERAL_RATE_LIMIT).
export const generalLimiter = rateLimit({
  ...common,
  max: config.rateLimit.general,
  message: {
    success: false,
    statusCode: Status.TOO_MANY_REQUESTS,
    message: `Too many requests from this IP, please try again after ${windowMinutes} minutes`,
  },
});

// Authentication limiter (AUTH_RATE_LIMIT).
export const authLimiter = rateLimit({
  ...common,
  max: config.rateLimit.auth,
  message: {
    success: false,
    statusCode: Status.TOO_MANY_REQUESTS,
    message: `Too many login/verification attempts from this IP, please try again after ${windowMinutes} minutes`,
  },
});

// Public QR verification / print limiter: strict to prevent ID probing.
export const publicVerifyLimiter = rateLimit({
  ...common,
  max: config.rateLimit.publicVerify,
  message: {
    success: false,
    statusCode: Status.TOO_MANY_REQUESTS,
    message:
      "Too many verification requests from this IP, please try again later",
  },
});
