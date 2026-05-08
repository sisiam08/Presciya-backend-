import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import { AuthServices } from "./auth.service";
import sendResponse from "../../utils/sendResponse";
import { Status } from "../../errors/httpStatus";

const setCookies = async (res: Response, token: string) => {
  const cookieOptions = {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  } as const;

  res.cookie("accessToken", token, cookieOptions);
};

const signUp = catchAsync(async (req: Request, res: Response) => {
  const data = await AuthServices.signUp(req.body);

  if (data.token) {
    setCookies(res, data.token);
  }

  sendResponse(res, {
    statusCode: Status.CREATED,
    success: true,
    message: "User created successfully",
    data,
  });
});

const logIn = catchAsync(async (req: Request, res: Response) => {
  const data = await AuthServices.logIn(req.body);

  if (data.token) {
    setCookies(res, data.token);
  }

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "User logged in successfully",
    data,
  });
});

export const AuthController = {
  signUp,
  logIn,
};
