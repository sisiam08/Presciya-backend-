import { Response } from "express";
import catchAsync from "../../utils/catchAsync";
import { InstitutionServices } from "./institution.service";
import sendResponse from "../../utils/sendResponse";
import { Status } from "../../errors/httpStatus";
import { requireStringParam } from "../../utils/requestParams";
import { AuthenticatedRequest } from "../../middleware/auth";

const createInstitution = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const workspaceId = req.user?.activeWorkspaceId as string;
    const result = await InstitutionServices.createInstitutionWithVerification(
      workspaceId,
      req.body,
    );

    sendResponse(res, {
      statusCode: Status.CREATED,
      success: true,
      message: "Institution profile created successfully",
      data: result,
    });
  },
);

const getInstitutionProfile = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const workspaceId = req.user?.activeWorkspaceId as string;
    const result = await InstitutionServices.getInstitutionProfile(workspaceId);

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: "Institution profile fetched successfully",
      data: result,
    });
  },
);

const updateInstitution = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const workspaceId = req.user?.activeWorkspaceId as string;
    const result = await InstitutionServices.updateInstitution(
      workspaceId,
      req.body,
    );

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: "Institution profile updated successfully",
      data: result,
    });
  },
);

const updateBranding = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const workspaceId = req.user?.activeWorkspaceId as string;
    const result = await InstitutionServices.updateBranding(
      workspaceId,
      req.body,
    );

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: "Institution branding updated successfully",
      data: result,
    });
  },
);

const createDepartment = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const workspaceId = req.user?.activeWorkspaceId as string;
    const result = await InstitutionServices.createDepartment(
      workspaceId,
      req.body,
    );

    sendResponse(res, {
      statusCode: Status.CREATED,
      success: true,
      message: "Department created successfully",
      data: result,
    });
  },
);

const getDepartments = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const workspaceId = req.user?.activeWorkspaceId as string;
    const result = await InstitutionServices.getDepartments(workspaceId);

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: "Departments fetched successfully",
      data: result,
    });
  },
);

const assignDoctor = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const workspaceId = req.user?.activeWorkspaceId as string;
    const result = await InstitutionServices.assignDoctor(
      workspaceId,
      req.body,
    );

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: "Doctor assigned successfully to institution",
      data: result,
    });
  },
);

const removeDoctor = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const workspaceId = req.user?.activeWorkspaceId as string;
    const doctorId = requireStringParam(req.params.doctorId, "Doctor ID");
    await InstitutionServices.removeDoctor(workspaceId, doctorId);

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: "Doctor removed successfully from institution",
      data: null,
    });
  },
);

const getAssignedDoctors = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const workspaceId = req.user?.activeWorkspaceId as string;
    const result = await InstitutionServices.getAssignedDoctors(workspaceId);

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: "Assigned doctors fetched successfully",
      data: result,
    });
  },
);

export const InstitutionControllers = {
  createInstitution,
  getInstitutionProfile,
  updateInstitution,
  updateBranding,
  createDepartment,
  getDepartments,
  assignDoctor,
  removeDoctor,
  getAssignedDoctors,
};
