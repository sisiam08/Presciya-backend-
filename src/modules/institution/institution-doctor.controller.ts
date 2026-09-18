import { Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { InstitutionDoctorServices } from "./institution-doctor.service";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import { AuthenticatedRequest } from "../../middleware/auth";



/**
 * Get all doctors in an institution
 * GET /api/institution-doctors/:institutionId
 */
export const getInstitutionDoctors = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { institutionId } = req.params as { institutionId: string };

    if (!institutionId) {
      throw createAppError("institutionId is required", Status.BAD_REQUEST);
    }

    const doctors =
      await InstitutionDoctorServices.getInstitutionDoctors(institutionId);

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: `Found ${doctors.length} doctor(s) in institution`,
      data: doctors,
    });
  },
);

/**
 * Get institution doctor assignment details
 * GET /api/institution-doctors/assignment/:id
 */
export const getInstitutionDoctorDetails = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params as { id: string };

    if (!id) {
      throw createAppError("Assignment ID is required", Status.BAD_REQUEST);
    }

    const assignment =
      await InstitutionDoctorServices.getInstitutionDoctorDetails(id);

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: "Assignment details retrieved",
      data: assignment,
    });
  },
);

/**
 * Update doctor assignment (change department or active status)
 * PUT /api/institution-doctors/:id
 */
export const updateDoctorAssignment = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params as { id: string };
    const { departmentId, isActive } = req.body;

    if (!userId) {
      throw createAppError("User not authenticated", Status.UNAUTHORIZED);
    }

    if (!id) {
      throw createAppError("Assignment ID is required", Status.BAD_REQUEST);
    }

    if (departmentId === undefined && isActive === undefined) {
      throw createAppError(
        "At least one field (departmentId or isActive) must be provided",
        Status.BAD_REQUEST,
      );
    }

    const updateData: any = {};
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    if (isActive !== undefined) updateData.isActive = isActive;

    const result = await InstitutionDoctorServices.updateDoctorAssignment(
      id,
      userId,
      updateData,
    );

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: "Doctor assignment updated successfully",
      data: result,
    });
  },
);

/**
 * Remove doctor from institution
 * DELETE /api/institution-doctors/:id
 */
export const removeDoctorFromInstitution = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params as { id: string };

    if (!userId) {
      throw createAppError("User not authenticated", Status.UNAUTHORIZED);
    }

    if (!id) {
      throw createAppError("Assignment ID is required", Status.BAD_REQUEST);
    }

    const result = await InstitutionDoctorServices.removeDoctorFromInstitution(
      id,
      userId,
    );

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: "Doctor removed from institution successfully",
      data: result,
    });
  },
);

export const InstitutionDoctorController = {
  getInstitutionDoctors,
  getInstitutionDoctorDetails,
  updateDoctorAssignment,
  removeDoctorFromInstitution,
};
