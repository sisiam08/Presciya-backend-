import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { DoctorServices } from "./doctor.service";
import { Status } from "../../errors/httpStatus";
import { createAppError } from "../../errors/appError";
import { IUpdateDoctorProfile } from "../../interface";
import sharp from "sharp";
import { uploadFileToCloudinary } from "../../config/cloudinary.config";
import { AuthenticatedRequest } from "../../middleware/auth";

const assignDoctor = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const invitedById = req.user?.id!;
    const workspaceId = req.workspaceId!;
    const doctorData = req.body;
    const data = await DoctorServices.assignDoctor(
      doctorData,
      workspaceId,
      invitedById,
    );
    sendResponse(res, {
      statusCode: Status.CREATED,
      success: true,
      message: "Invitation sent successfully",
      data,
    });
  },
);

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
  const workspaceId = (req as any).workspaceId as string;
  const data = await DoctorServices.getDoctorProfileById(
    doctorId as string,
    workspaceId,
  );
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Doctor profile retrieved successfully",
    data,
  });
});

const getAllDoctors = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId as string;
  const data = await DoctorServices.getAllDoctors(workspaceId);
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Workspace doctors retrieved successfully",
    data,
  });
});

const getMyDoctors = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId;
  const data = await DoctorServices.getMyDoctors(workspaceId);
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Doctors retrieved successfully",
    data,
  });
});

const updateDoctorProfile = catchAsync(async (req: Request, res: Response) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const doctorUpdateData: IUpdateDoctorProfile = { ...req.body };

  const uploadTasks: Promise<void>[] = [];

  const signatureFile = files?.signature?.[0];
  if (signatureFile) {
    uploadTasks.push(
      (async () => {
        const buffer = await sharp(signatureFile.buffer)
          .resize(800, 400, { fit: "inside" })
          .webp({ quality: 80 })
          .toBuffer();
        const result = await uploadFileToCloudinary(
          buffer,
          signatureFile.originalname.replace(/\.[^.]+$/, ".webp"),
        );
        doctorUpdateData.signatureUrl = result.secure_url;
      })(),
    );
  }

  const imageFile = files?.image?.[0];
  if (imageFile) {
    uploadTasks.push(
      (async () => {
        const buffer = await sharp(imageFile.buffer)
          .resize(500, 500, { fit: "cover" })
          .webp({ quality: 80 })
          .toBuffer();
        const result = await uploadFileToCloudinary(
          buffer,
          imageFile.originalname.replace(/\.[^.]+$/, ".webp"),
        );
        doctorUpdateData.image = result.secure_url;
      })(),
    );
  }

  await Promise.all(uploadTasks);

  const userId = req.user?.id!;
  const data = await DoctorServices.updateDoctorProfile(
    doctorUpdateData,
    userId,
  );
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
