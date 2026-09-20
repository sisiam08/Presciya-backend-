import { Router, Request, Response } from "express";
import AdminRouters from "../modules/admin/admin.router";
import { IRoute } from "../interface";
import { AuthRouters } from "../modules/auth/auth.router";
import { DoctorRouters } from "../modules/doctor/doctor.router";
import { InstitutionRouters } from "../modules/institution/institution.router";
import { ChamberRouters } from "../modules/chamber/chamber.router";
import { PatientRouters } from "../modules/patient/patient.router";
import { PrescriptionRouters } from "../modules/prescription/prescription.router";
import { AppointmentRouters } from "../modules/appointment/appointment.router";
import { MedicineRouters } from "../modules/medicine/medicine.router";
import { AnalyticsRouters } from "../modules/analytics/analytics.router";
import { SubscriptionRouters } from "../modules/subscription/subscription.router";
import workspaceRouter from "../modules/workspace/workspace.router";
import verificationRouter from "../modules/verification/verification.router";
import departmentRouter from "../modules/department/department.router";
import institutionDoctorRouter from "../modules/institution/institution-doctor.router";
import { NotificationRouters } from "../modules/notification/notification.router";
import templateRouter from "../modules/template/template.router";
import { FinanceRouters } from "../modules/finance/finance.router";
import { FeeRouters } from "../modules/fee/fee.router";
import { RevenueRouters } from "../modules/revenue/revenue.router";
import { SystemRouters } from "../modules/system/system.router";

const router = Router();

router.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

const routes: IRoute[] = [
  {
    path: "/auth",
    route: AuthRouters,
  },
  {
    path: "/workspaces",
    route: workspaceRouter,
  },
  {
    path: "/doctor",
    route: DoctorRouters,
  },
  {
    path: "/institution",
    route: InstitutionRouters,
  },
  {
    path: "/chamber",
    route: ChamberRouters,
  },
  {
    path: "/patient",
    route: PatientRouters,
  },
  {
    path: "/prescription",
    route: PrescriptionRouters,
  },
  {
    path: "/appointment",
    route: AppointmentRouters,
  },
  {
    path: "/medicine",
    route: MedicineRouters,
  },
  {
    path: "/analytics",
    route: AnalyticsRouters,
  },
  {
    path: "/verification",
    route: verificationRouter,
  },
  {
    path: "/departments",
    route: departmentRouter,
  },
  {
    path: "/institution-doctors",
    route: institutionDoctorRouter,
  },
  {
    path: "/subscription",
    route: SubscriptionRouters,
  },
  {
    path: "/admin",
    route: AdminRouters,
  },
  {
    path: "/notifications",
    route: NotificationRouters,
  },
  {
    path: "/prescription-templates",
    route: templateRouter,
  },
  {
    path: "/finance",
    route: FinanceRouters,
  },
  {
    path: "/visiting-fee",
    route: FeeRouters,
  },
  {
    path: "/revenue-share",
    route: RevenueRouters,
  },
  {
    path: "/system",
    route: SystemRouters,
  },
];

routes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
