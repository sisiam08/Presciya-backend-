import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { Status } from "../../errors/httpStatus";
import { requireStringParam } from "../../utils/requestParams";
import { FeeServices } from "./fee.service";

const meta = (req: Request) => ({
  ipAddress: req.ip,
  userAgent: req.headers["user-agent"] as string | undefined,
});

const upsertMyFee = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const result = await FeeServices.upsertMyFee(
    userId,
    workspaceId,
    req.body,
    meta(req),
  );
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Visiting fee saved",
    data: result,
  });
});

const getMyFee = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const result = await FeeServices.getMyFee(userId, workspaceId);
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Visiting fee fetched",
    data: result,
  });
});

const getDoctorFee = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const doctorId = requireStringParam(req.params.doctorId, "Doctor ID");
  const result = await FeeServices.getDoctorFee(userId, workspaceId, doctorId);
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Doctor visiting fee fetched",
    data: result,
  });
});

export const FeeControllers = {
  upsertMyFee,
  getMyFee,
  getDoctorFee,
};
