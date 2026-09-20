import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { Status } from "../../errors/httpStatus";
import { SystemServices } from "./system.service";

// Public feature availability. No auth: the signup page needs it before login.
const getAvailability = catchAsync(async (_req: Request, res: Response) => {
  const availability = await SystemServices.getAvailability();

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Feature availability fetched",
    data: availability,
  });
});

export const SystemControllers = {
  getAvailability,
};
