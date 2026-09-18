import { Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { DepartmentServices } from "./department.service";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import { AuthenticatedRequest } from "../../middleware/auth";

/**
 * Create a new department
 * POST /api/departments
 */
export const createDepartment = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const { institutionId, name, description } = req.body;

    if (!userId) {
      throw createAppError("User not authenticated", Status.UNAUTHORIZED);
    }

    if (!institutionId) {
      throw createAppError("institutionId is required", Status.BAD_REQUEST);
    }

    if (!name || typeof name !== "string") {
      throw createAppError(
        "name is required and must be a string",
        Status.BAD_REQUEST,
      );
    }

    const result = await DepartmentServices.createDepartment(
      userId,
      institutionId,
      { name, description },
    );

    sendResponse(res, {
      statusCode: Status.CREATED,
      success: true,
      message: "Department created successfully",
      data: result,
    });
  },
);

/**
 * Get all departments for an institution
 * GET /api/departments/:institutionId
 */
export const getDepartmentsByInstitution = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { institutionId } = req.params as { institutionId: string };

    if (!institutionId) {
      throw createAppError("institutionId is required", Status.BAD_REQUEST);
    }

    const departments =
      await DepartmentServices.getDepartmentsByInstitution(institutionId);

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: `Found ${departments.length} department(s)`,
      data: departments,
    });
  },
);

/**
 * Get department details
 * GET /api/departments/:id
 */
export const getDepartmentDetails = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params as { id: string };

    if (!id) {
      throw createAppError("Department ID is required", Status.BAD_REQUEST);
    }

    const department = await DepartmentServices.getDepartmentDetails(id);

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: "Department details retrieved",
      data: department,
    });
  },
);

/**
 * Update department
 * PUT /api/departments/:id
 */
export const updateDepartment = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params as { id: string };
    const { name, description } = req.body;

    if (!userId) {
      throw createAppError("User not authenticated", Status.UNAUTHORIZED);
    }

    if (!id) {
      throw createAppError("Department ID is required", Status.BAD_REQUEST);
    }

    if (!name && !description) {
      throw createAppError(
        "At least one field (name or description) must be provided",
        Status.BAD_REQUEST,
      );
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (description) updateData.description = description;

    const result = await DepartmentServices.updateDepartment(
      id,
      userId,
      updateData,
    );

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: "Department updated successfully",
      data: result,
    });
  },
);

/**
 * Delete department
 * DELETE /api/departments/:id
 */
export const deleteDepartment = catchAsync(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params as { id: string };

    if (!userId) {
      throw createAppError("User not authenticated", Status.UNAUTHORIZED);
    }

    if (!id) {
      throw createAppError("Department ID is required", Status.BAD_REQUEST);
    }

    const result = await DepartmentServices.deleteDepartment(id, userId);

    sendResponse(res, {
      statusCode: Status.OK,
      success: true,
      message: "Department deleted successfully",
      data: result,
    });
  },
);

export const DepartmentController = {
  createDepartment,
  getDepartmentsByInstitution,
  getDepartmentDetails,
  updateDepartment,
  deleteDepartment,
};
