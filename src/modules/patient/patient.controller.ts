import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import { PatientServices } from "./patient.service";
import sendResponse from "../../utils/sendResponse";
import { Status } from "../../errors/httpStatus";
import { requireStringParam } from "../../utils/requestParams";

const createPatient = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const result = await PatientServices.createPatient(
    userId,
    workspaceId,
    req.body,
  );

  sendResponse(res, {
    statusCode: Status.CREATED,
    success: true,
    message: "Patient registered successfully",
    data: result,
  });
});

const getPatientById = catchAsync(async (req: Request, res: Response) => {
  const id = requireStringParam(req.params.id, "Patient ID");
  const result = await PatientServices.getPatientById(id);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Patient fetched successfully",
    data: result,
  });
});

const updatePatient = catchAsync(async (req: Request, res: Response) => {
  const id = requireStringParam(req.params.id, "Patient ID");
  const userId = req.user?.id as string;
  const result = await PatientServices.updatePatient(id, userId, req.body);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Patient updated successfully",
    data: result,
  });
});

const deletePatient = catchAsync(async (req: Request, res: Response) => {
  const id = requireStringParam(req.params.id, "Patient ID");
  const userId = req.user?.id as string;
  await PatientServices.deletePatient(id, userId);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Patient record soft-deleted successfully",
    data: null,
  });
});

const searchPatients = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const { q = "", page = 1, limit = 10 } = req.query;

  const result = await PatientServices.searchPatients(
    userId,
    workspaceId,
    q as string,
    Number(page),
    Number(limit),
  );

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Patients search complete",
    data: result.patients,
    meta: result.meta,
  });
});

const getPatientTimeline = catchAsync(async (req: Request, res: Response) => {
  const id = requireStringParam(req.params.id, "Patient ID");
  const result = await PatientServices.getPatientTimeline(id);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Patient timeline activity fetched successfully",
    data: result,
  });
});

export const PatientControllers = {
  createPatient,
  getPatientById,
  updatePatient,
  deletePatient,
  searchPatients,
  getPatientTimeline,
};
