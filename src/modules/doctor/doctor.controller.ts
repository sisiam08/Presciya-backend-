import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { DoctorServices } from "./doctor.service";
import { Status } from "../../errors/httpStatus";

const assignDoctor = catchAsync(async (req: Request, res: Response) => {
  const institutionalId = req.user?.id!;
  const doctorData = { ...req.body, institutionalId };
  const data = await DoctorServices.assignDoctor(doctorData);
  sendResponse(res, {
    statusCode: Status.CREATED,
    success: true,
    message: "Doctor assigned successfully",
    data,
  });
});

const getDoctorProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id!;
  const data = await DoctorServices.getDoctorProfile(userId);
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Doctor profile retrieved successfully",
    data,
  });
});

const getDoctorProfileById = catchAsync(async (req: Request, res: Response) => {
  const doctorId = req.params.id;
  const data = await DoctorServices.getDoctorProfileById(doctorId as string);
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Doctor profile retrieved successfully",
    data,
  });
});

const getAllDoctors = catchAsync(async (req: Request, res: Response) => {
  const data = await DoctorServices.getAllDoctors();
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "All doctors retrieved successfully",
    data,
  });
});

const getMyDoctors = catchAsync(async (req: Request, res: Response) => {
  const institutionalId = req.user?.id!;
  const data = await DoctorServices.getMyDoctors(institutionalId);
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Doctors retrieved successfully",
    data,
  });
});

const updateDoctorProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id!;
  const data = await DoctorServices.updateDoctorProfile(req.body, userId);
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Doctor profile updated successfully",
    data,
  });
});

export const DoctorControllers = {
  assignDoctor,
  getDoctorProfile,
  getDoctorProfileById,
  getAllDoctors,
  getMyDoctors,
  updateDoctorProfile,
};
