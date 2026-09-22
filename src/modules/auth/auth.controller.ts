import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import { AuthServices } from "./auth.service";
import sendResponse from "../../utils/sendResponse";
import { Status } from "../../errors/httpStatus";
import { createAppError } from "../../errors/appError";

const setCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string,
) => {
  const isProduction = process.env.NODE_ENV === "production";

  const cookieOptions = {
    secure: isProduction,
    httpOnly: true,
    sameSite: isProduction ? "strict" : ("lax" as const),
    path: "/",
  } as const;

  res.cookie("accessToken", accessToken, {
    ...cookieOptions,
    httpOnly: false,
    maxAge: 1000 * 60 * 60,
  });

  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
};

const clearCookies = (res: Response) => {
  const isProduction = process.env.NODE_ENV === "production";

  const cookieOptions = {
    secure: isProduction,
    httpOnly: true,
    sameSite: isProduction ? "strict" : ("lax" as const),
    path: "/",
  } as const;

  res.clearCookie("accessToken", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);
};

const sendOTP = catchAsync(async (req: Request, res: Response) => {
  const { name, email } = req.body;
  const result = await AuthServices.sendOTP(name, email);

  sendResponse(res, {
    statusCode: Status.CREATED,
    success: true,
    message: result.message,
    data: {
      email: result.email,
      expiresIn: result.expiresIn,
    },
  });
});

const signUp = catchAsync(async (req: Request, res: Response) => {
  const deviceInfo = req.headers["user-agent"];
  const ipAddress = req.ip;

  const result = await AuthServices.signUp(req.body, deviceInfo, ipAddress);

  sendResponse(res, {
    statusCode: Status.CREATED,
    success: true,
    message: "Account created successfully.",
    data: result,
  });
});

const logIn = catchAsync(async (req: Request, res: Response) => {
  const deviceInfo = req.headers["user-agent"];
  const ipAddress = req.ip;

  const result = await AuthServices.logIn(req.body, deviceInfo, ipAddress);

  if (result.accessToken && result.refreshToken) {
    setCookies(res, result.accessToken, result.refreshToken);
  }

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: result.data.workspaces.length > 1 ? "Choose a workspace" : "User logged in successfully",
    data: {
      user: result.data,
      accessToken: result.accessToken,
    },
  });
});

const switchWorkspace = catchAsync(async (req: Request, res: Response) => {
  const deviceInfo = req.headers["user-agent"];
  const ipAddress = req.ip;

  // Identity MUST come exclusively from the verified access token (req.user),
  // never from client-supplied body/query/params (prevents identity spoofing).
  const actingUserId = req.user?.id;

  if (!actingUserId) {
    throw createAppError("Unauthorized", Status.UNAUTHORIZED);
  }

  const { workspaceId } = req.body;

  const result = await AuthServices.switchWorkspace(
    actingUserId,
    workspaceId,
    deviceInfo,
    ipAddress,
  );

  if (result.accessToken && result.refreshToken) {
    setCookies(res, result.accessToken, result.refreshToken);
  }

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "User logged in successfully",
    data: {
      user: result.data,
      accessToken: result.accessToken,
    },
  });
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const token = req.cookies.refreshToken;
  const deviceInfo = req.headers["user-agent"];
  const ipAddress = req.ip;

  const result = await AuthServices.refreshToken(token, deviceInfo, ipAddress);

  setCookies(res, result.accessToken, result.refreshToken);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Access token refreshed successfully",
    data: {
      accessToken: result.accessToken,
    },
  });
});

const logOut = catchAsync(async (req: Request, res: Response) => {
  const token = req.cookies.refreshToken;

  if (token) {
    await AuthServices.logOut(token);
  }

  await clearCookies(res);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "User logged out successfully",
    data: null,
  });
});

const logoutAll = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (userId) {
    await AuthServices.logoutAll(userId);
  }

  await clearCookies(res);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Logged out from all devices successfully",
    data: null,
  });
});

const getCurrentUser = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    throw createAppError("Unauthorized", Status.UNAUTHORIZED);
  }

  const result = await AuthServices.getCurrentUser(userId);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Current user retrieved successfully",
    data: result,
  });
});

const updateMe = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    throw createAppError("Unauthorized", Status.UNAUTHORIZED);
  }

  const result = await AuthServices.updateMe(userId, req.body);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Account updated successfully",
    data: result,
  });
});

const forgetPassword = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  const result = await AuthServices.forgetPassword(email);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: result.message,
    data: null,
  });
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  await AuthServices.resetPassword(token, newPassword);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Password reset successfully",
    data: null,
  });
});

export const AuthControllers = {
  sendOTP,
  signUp,
  logIn,
  switchWorkspace,
  getCurrentUser,
  updateMe,
  refreshToken,
  logOut,
  logoutAll,
  forgetPassword,
  resetPassword,
};
