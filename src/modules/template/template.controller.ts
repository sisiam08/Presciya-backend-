import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import { TemplateServices } from "./template.service";
import sendResponse from "../../utils/sendResponse";
import { Status } from "../../errors/httpStatus";
import { requireStringParam } from "../../utils/requestParams";

const createTemplate = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId as string;
  const userId = req.user?.id as string;
  const result = await TemplateServices.createTemplate(
    workspaceId,
    userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: Status.CREATED,
    success: true,
    message: "Template saved successfully",
    data: result,
  });
});

const listTemplates = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId as string;
  const result = await TemplateServices.listTemplates(workspaceId);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Templates fetched successfully",
    data: result,
  });
});

const getTemplate = catchAsync(async (req: Request, res: Response) => {
  const id = requireStringParam(req.params.id, "Template ID");
  const workspaceId = (req as any).workspaceId as string;
  const result = await TemplateServices.getTemplate(id, workspaceId);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Template fetched successfully",
    data: result,
  });
});

const updateTemplate = catchAsync(async (req: Request, res: Response) => {
  const id = requireStringParam(req.params.id, "Template ID");
  const workspaceId = (req as any).workspaceId as string;
  const result = await TemplateServices.updateTemplate(id, workspaceId, req.body);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Template updated successfully",
    data: result,
  });
});

const deleteTemplate = catchAsync(async (req: Request, res: Response) => {
  const id = requireStringParam(req.params.id, "Template ID");
  const workspaceId = (req as any).workspaceId as string;
  await TemplateServices.deleteTemplate(id, workspaceId);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Template deleted successfully",
    data: null,
  });
});

export const TemplateControllers = {
  createTemplate,
  listTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
};
