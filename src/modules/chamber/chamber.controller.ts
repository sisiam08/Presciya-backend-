import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import { ChamberServices } from "./chamber.service";
import sendResponse from "../../utils/sendResponse";
import { Status } from "../../errors/httpStatus";

const createChamber = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const result = await ChamberServices.createChamber(
    userId,
    req.body,
    (req as any).workspaceId,
  );

  sendResponse(res, {
    statusCode: Status.CREATED,
    success: true,
    message: "Chamber created successfully",
    data: result,
  });
});

const getChamberById = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await ChamberServices.getChamberById(id);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Chamber fetched successfully",
    data: result,
  });
});

const getMyChambers = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const result = await ChamberServices.getMyChambers(userId);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Chambers fetched successfully",
    data: result,
  });
});

const updateChamber = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const userId = req.user?.id as string;
  const result = await ChamberServices.updateChamber(id, userId, req.body);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Chamber updated successfully",
    data: result,
  });
});

const deleteChamber = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const userId = req.user?.id as string;
  await ChamberServices.deleteChamber(id, userId);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Chamber deleted successfully",
    data: null,
  });
});

const addChamberSchedule = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await ChamberServices.addChamberSchedule(id, req.body);

  sendResponse(res, {
    statusCode: Status.CREATED,
    success: true,
    message: "Schedule added successfully",
    data: result,
  });
});

const deleteChamberSchedule = catchAsync(async (req: Request, res: Response) => {
  const scheduleId = req.params.scheduleId as string;
  await ChamberServices.deleteChamberSchedule(scheduleId);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Schedule deleted successfully",
    data: null,
  });
});

const createAppointment = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const result = await ChamberServices.createAppointment(
    workspaceId,
    id,
    req.body,
  );

  sendResponse(res, {
    statusCode: Status.CREATED,
    success: true,
    message: "Appointment serial booked successfully",
    data: result,
  });
});

const getChamberAppointments = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const { date } = req.query;
  const result = await ChamberServices.getChamberAppointments(
    workspaceId,
    id,
    date as string,
  );

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Appointments fetched successfully",
    data: result,
  });
});

export const ChamberControllers = {
  createChamber,
  getChamberById,
  getMyChambers,
  updateChamber,
  deleteChamber,
  addChamberSchedule,
  deleteChamberSchedule,
  createAppointment,
  getChamberAppointments,
};
