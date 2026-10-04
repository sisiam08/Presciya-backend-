import rateLimit from "express-rate-limit";
import { Status } from "../errors/httpStatus";
import config from "../config";




const skipPreflight = (req: any) =>
  req.method === "OPTIONS" ||
  (typeof req.originalUrl === "string" &&
    req.originalUrl.startsWith("/api/v1/health"));

const windowMinutes = Math.round(config.rateLimit.windowMs / 60000);
const common = {
  windowMs: config.rateLimit.windowMs,
  skip: skipPreflight,
  standardHeaders: true, 
  legacyHeaders: false, 
};


export const generalLimiter = rateLimit({
  ...common,
  max: config.rateLimit.general,
  message: {
    success: false,
    statusCode: Status.TOO_MANY_REQUESTS,
    message: `Too many requests from this IP, please try again after ${windowMinutes} minutes`,
  },
});


export const authLimiter = rateLimit({
  ...common,
  max: config.rateLimit.auth,
  message: {
    success: false,
    statusCode: Status.TOO_MANY_REQUESTS,
    message: `Too many login/verification attempts from this IP, please try again after ${windowMinutes} minutes`,
  },
});


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
