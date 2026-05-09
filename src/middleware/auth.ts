import { NextFunction, Request, Response } from "express";
import { Status } from "../errors/httpStatus";
import jwt, { JwtPayload } from "jsonwebtoken";
import { UserRole } from "../../generated/prisma/enums";
import { createAppError } from "../errors/appError";
import config from "../config";
import { IAuthorizedUser } from "../interface";

export const auth_middleware = (role: UserRole[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies.accessToken;

      if (!token) {
        throw createAppError("Unauthorized", Status.UNAUTHORIZED);
      }

      const decode = jwt.verify(token, config.jwt.jwtSecret) as IAuthorizedUser;

      if (role.length && !role.includes(decode.role)) {
        throw createAppError(
          "You don't have permission to access this resource",
          Status.FORBIDDEN,
        );
      }

      req.user = decode;

      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return next(createAppError("Token has expired, please log in again", Status.UNAUTHORIZED));
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return next(createAppError("Invalid token", Status.UNAUTHORIZED));
      }
      next(error);
    }
  };
};
