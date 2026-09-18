import rateLimit from "express-rate-limit";
import { Status } from "../errors/httpStatus";

// General API rate limiter: max 300 requests per 15 minutes
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
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
  message: {
    success: false,
    statusCode: Status.TOO_MANY_REQUESTS,
    message: "Too many verification requests from this IP, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
