import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import { AppointmentService } from "./appointment.service";

const create = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id as string;
  const workspaceId = (req as any).workspaceId as string;
  const appointment = await AppointmentService.createAppointment(
    userId,
    workspaceId,
    req.body,
  );
  res.status(201).json(appointment);
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
  res.json(updated);
});

const list = catchAsync(async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId as string;
  const { doctorId, patientId, from, to, page, limit } = req.query as any;
  const filters: any = { doctorId, patientId };
  if (from) filters.from = new Date(from);
  if (to) filters.to = new Date(to);
  const data = await AppointmentService.listAppointments(
    workspaceId,
    filters,
    parseInt(page || "1"),
    parseInt(limit || "20"),
  );
  res.json(data);
});

export const AppointmentController = { create, updateStatus, list };
