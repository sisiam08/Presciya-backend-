import rateLimit from "express-rate-limit";
import { Status } from "../errors/httpStatus";

// CORS preflight requests and health probes must never be rate-limited: a
// blocked preflight breaks the browser's ability to even read the error, and
// health checks should always respond.
const skipPreflight = (req: any) =>
  req.method === "OPTIONS" ||
  (typeof req.originalUrl === "string" &&
    req.originalUrl.startsWith("/api/v1/health"));

// General API rate limiter: max 300 requests per 15 minutes
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  skip: skipPreflight,
  message: {
    success: false,
    statusCode: Status.TOO_MANY_REQUESTS,
    message: "Too many requests from this IP, please try again after 15 minutes",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,  // Disable the `X-RateLimit-*` headers
});

// Authentication rate limiter: max 10 attempts per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  skip: skipPreflight,
  message: {
    success: false,
    statusCode: Status.TOO_MANY_REQUESTS,
    message: "Too many login/verification attempts from this IP, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public QR verification / print limiter: strict to prevent ID probing
export const publicVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  skip: skipPreflight,
  message: {
    success: false,
    statusCode: Status.TOO_MANY_REQUESTS,
    message: "Too many verification requests from this IP, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
