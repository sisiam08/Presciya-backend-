import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { Status } from "../../errors/httpStatus";
import { requireStringParam } from "../../utils/requestParams";
import {
  chamberIdFromRequest,
  resolveChamberScope,
} from "../../utils/chamberScope";
import { AppointmentService } from "./appointment.service";

const meta = (req: Request) => ({
  ipAddress: req.ip,
  userAgent: req.headers["user-agent"] as string | undefined,
});

const create = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const appointment = await AppointmentService.createAppointment(
    userId,
    workspaceId,
    req.body,
    meta(req),
  );
  sendResponse(res, {
    statusCode: Status.CREATED,
    success: true,
    message: "Appointment created successfully",
    data: appointment,
  });
});

const recordPayment = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const id = requireStringParam(req.params.id, "Appointment ID");
  const updated = await AppointmentService.recordPayment(
    id,
    userId,
    workspaceId,
    req.body,
    meta(req),
  );
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Payment recorded successfully",
    data: updated,
  });
});

const searchToday = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const q = (req.query.q as string) || "";
  const doctorId = req.query.doctorId as string | undefined;
  const items = await AppointmentService.searchToday(
    userId,
    workspaceId,
    q,
    doctorId,
  );
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Today's appointments fetched",
    data: items,
  });
});

const getOne = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId as string;
  const id = requireStringParam(req.params.id, "Appointment ID");
  const appointment = await AppointmentService.getAppointment(id, workspaceId);
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Appointment fetched",
    data: appointment,
  });
});

const updateStatus = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const { id } = req.params as { id: string };
  const { status, cancelReason } = req.body;
  const updated = await AppointmentService.updateStatus(
    id,
    userId,
    workspaceId,
    status,
    cancelReason,
  );
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Appointment status updated",
    data: updated,
  });
});

const list = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId as string;
  const { doctorId, patientId, from, to, date, page, limit } = req.query as any;
  // Chamber isolation: resolved from the current context and validated against
  // the caller's workspace before the query runs.
  const chamberId = await resolveChamberScope(
    workspaceId,
    chamberIdFromRequest(req),
  );
  const filters: any = { doctorId, patientId, date, chamberId };
  if (from) filters.from = new Date(from);
  if (to) filters.to = new Date(to);
  const data = await AppointmentService.listAppointments(
    workspaceId,
    filters,
    parseInt(page || "1"),
    parseInt(limit || "20"),
  );
  sendResponse(res, {
    statusCode: Status.OK,
    success: true,
    message: "Appointments fetched",
    data: data.items,
    meta: data.meta,
  });
});

export const AppointmentController = {
  create,
  recordPayment,
  searchToday,
  getOne,
  updateStatus,
  list,
};
