import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import { PrescriptionServices } from "./prescription.service";
import sendResponse from "../../utils/sendResponse";
import { Status } from "../../errors/httpStatus";
import { requireStringParam } from "../../utils/requestParams";
import {
  WorkspaceRole,
  WorkspaceType,
  PrescriptionLanguage,
  PrescriptionDesignTemplate,
} from "../../../generated/prisma/enums";

const createPrescription = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;

  const result = await PrescriptionServices.createPrescription(
    userId,
    workspaceId,
    req.body,
  );

  sendResponse(res, {
    statusCode: Status.CREATED,
    success: true,
    message: "Prescription generated successfully",
    data: result,
  });
});

const getPrescriptionById = catchAsync(async (req: Request, res: Response) => {
  const id = requireStringParam(req.params.id, "Prescription ID");
  const workspaceId = (req as any).workspaceId as string;
  const result = await PrescriptionServices.getPrescriptionById(id, workspaceId);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Prescription details fetched successfully",
    data: result,
  });
});

const updatePrescription = catchAsync(async (req: Request, res: Response) => {
  const id = requireStringParam(req.params.id, "Prescription ID");
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const result = await PrescriptionServices.updatePrescription(
    id,
    userId,
    workspaceId,
    req.body,
  );

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Prescription updated successfully",
    data: result,
  });
});

const deletePrescription = catchAsync(async (req: Request, res: Response) => {
  const id = requireStringParam(req.params.id, "Prescription ID");
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  await PrescriptionServices.deletePrescription(id, userId, workspaceId);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Prescription deleted successfully",
    data: null,
  });
});

const getMyPrescriptions = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceType = req.user?.workspaceType as WorkspaceType;
  const workspaceId = (req as any).workspaceId as string;
  const { patientPhone, chamberId, page = 1, limit = 10 } = req.query;

  const result = await PrescriptionServices.getMyPrescriptions(
    userId,
    workspaceType,
    workspaceId,
    {
      patientPhone: patientPhone as string,
      chamberId: chamberId as string,
    },
    Number(page),
    Number(limit),
  );

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Prescriptions list complete",
    data: result.prescriptions,
    meta: result.meta,
  });
});

const finalizePrescription = catchAsync(async (req: Request, res: Response) => {
  const id = requireStringParam(req.params.id, "Prescription ID");
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;

  const result = await PrescriptionServices.finalizePrescription(
    id,
    userId,
    workspaceId,
  );

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Prescription finalized successfully",
    data: result,
  });
});

const printPrescription = catchAsync(async (req: Request, res: Response) => {
  const id = requireStringParam(req.params.id, "Prescription ID");
  // Public route: an authenticated doctor may print (logged); anonymous QR
  // viewers are allowed but not logged (print log has a User FK).
  const userId = req.user?.id;

  // Render the A4 print ready HTML template
  const html = await PrescriptionServices.compileHtmlPrescription(id);

  // Log printing metric
  const ipAddress = req.ip;
  const userAgent = req.headers["user-agent"];
  await PrescriptionServices.logPrint(id, userId, ipAddress, userAgent);

  res.setHeader("Content-Type", "text/html");
  res.status(Status.OK).send(html);
});

const amendPrescription = catchAsync(async (req: Request, res: Response) => {
  const id = requireStringParam(req.params.id, "Prescription ID");
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;

  const result = await PrescriptionServices.amendPrescription(
    id,
    userId,
    workspaceId,
  );

  sendResponse(res, {
    statusCode: Status.CREATED,
    success: true,
    message: "A corrected draft version was created",
    data: result,
  });
});

const previewPrescription = catchAsync(async (req: Request, res: Response) => {
  const id = requireStringParam(req.params.id, "Prescription ID");
  const workspaceId = (req as any).workspaceId as string;

  // Canonical A4 layout (same renderer as print), authenticated & workspace-scoped.
  const html = await PrescriptionServices.previewPrescription(id, workspaceId);

  res.setHeader("Content-Type", "text/html");
  res.status(Status.OK).send(html);
});

const previewTemplateSample = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const template = req.query.template as PrescriptionDesignTemplate;
  const language =
    (req.query.language as PrescriptionLanguage) ?? PrescriptionLanguage.ENGLISH;

  const html = await PrescriptionServices.previewTemplateSample(
    userId,
    workspaceId,
    template,
    language,
  );

  res.setHeader("Content-Type", "text/html");
  res.status(Status.OK).send(html);
});

const verifyPrescription = catchAsync(async (req: Request, res: Response) => {
  const id = requireStringParam(req.params.id, "Prescription ID");
  const result = await PrescriptionServices.verifyPrescriptionPublic(id);

  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Prescription record is verified as authentic",
    data: result,
  });
});

export const PrescriptionControllers = {
  createPrescription,
  getPrescriptionById,
  updatePrescription,
  deletePrescription,
  getMyPrescriptions,
  finalizePrescription,
  amendPrescription,
  printPrescription,
  previewPrescription,
  previewTemplateSample,
  verifyPrescription,
};
