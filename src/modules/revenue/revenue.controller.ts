import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { Status } from "../../errors/httpStatus";
import { requireStringParam } from "../../utils/requestParams";
import { RevenueServices } from "./revenue.service";

const meta = (req: Request) => ({
  ipAddress: req.ip,
  userAgent: req.headers["user-agent"] as string | undefined,
});

const getConfig = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const result = await RevenueServices.getConfig(userId, workspaceId);
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Revenue share configuration fetched",
    data: result,
  });
});

const setDefault = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const result = await RevenueServices.setDefault(
    userId,
    workspaceId,
    req.body.percentage,
    meta(req),
  );
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Default revenue share updated",
    data: result,
  });
});

const setOverride = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const doctorId = requireStringParam(req.params.doctorId, "Doctor ID");
  const result = await RevenueServices.setOverride(
    userId,
    workspaceId,
    doctorId,
    req.body.percentage,
    meta(req),
  );
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Doctor revenue share updated",
    data: result,
  });
});

const removeOverride = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const doctorId = requireStringParam(req.params.doctorId, "Doctor ID");
  await RevenueServices.removeOverride(
    userId,
    workspaceId,
    doctorId,
    meta(req),
  );
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Doctor revenue share override removed",
    data: null,
  });
});

export const RevenueControllers = {
  getConfig,
  setDefault,
  setOverride,
  removeOverride,
};
