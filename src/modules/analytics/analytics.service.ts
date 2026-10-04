import { prisma } from "../../lib/prisma";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import { WorkspaceType } from "../../../generated/prisma/enums";
import { RequestScope, scopeFilter } from "../../utils/chamberScope";


const getDoctorAnalytics = async (userId: string, scope: RequestScope) => {
  const doctor = await prisma.doctor.findUnique({
    where: { userId },
  });

  if (!doctor) {
    throw createAppError("Doctor profile not found", Status.NOT_FOUND);
  }

  const allWorkspaces = scope.mode === "all";
  
  const workspaceFilter = scopeFilter(scope);

  
  const totalPatients = await prisma.patient.count({
    where: { doctorId: doctor.id, isDeleted: false, ...workspaceFilter },
  });

  
  const totalPrescriptions = await prisma.prescription.count({
    where: { doctorUserId: doctor.userId, isDeleted: false, ...workspaceFilter },
  });

  
  
  
  
  
  const totalChambers = allWorkspaces
    ? await prisma.chamber.count({
        where: { workspace: { ownerId: doctor.userId }, isActive: true },
      })
    : scope.chamberId
      ? await prisma.chamber.count({
          where: { id: scope.chamberId, isActive: true },
        })
      : await prisma.chamber.count({
          where: { workspaceId: scope.workspaceId, isActive: true },
        });

  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const prescriptions = await prisma.prescription.findMany({
    where: {
      doctorUserId: doctor.userId,
      isDeleted: false,
      ...workspaceFilter,
      createdAt: { gte: sevenDaysAgo },
    },
    select: {
      createdAt: true,
    },
  });

  
  const trendMap: { [key: string]: number } = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0] as string;
    trendMap[dateStr] = 0;
  }

  prescriptions.forEach((item) => {
    const dateStr = item.createdAt.toISOString().split("T")[0] as string;
    if (trendMap[dateStr] !== undefined) {
      trendMap[dateStr] += 1;
    }
  });

  const formattedTrend = Object.keys(trendMap)
    .sort()
    .map((date) => ({
      date,
      count: trendMap[date],
    }));

  
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
  const linePrescriptions = await prisma.prescription.findMany({
    where: {
      doctorUserId: doctor.userId,
      isDeleted: false,
      ...workspaceFilter,
      createdAt: { gte: fifteenDaysAgo },
    },
    select: {
      createdAt: true,
    },
  });

  const lineMap: { [key: string]: number } = {};
  for (let i = 0; i < 15; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0] as string;
    lineMap[dateStr] = 0;
  }

  linePrescriptions.forEach((item) => {
    const dateStr = item.createdAt.toISOString().split("T")[0] as string;
    if (lineMap[dateStr] !== undefined) {
      lineMap[dateStr] += 1;
    }
  });

  const formattedLineTrend = Object.keys(lineMap)
    .sort()
    .map((date) => ({
      date,
      count: lineMap[date],
    }));

  
  const malePatients = await prisma.patient.count({
    where: { doctorId: doctor.id, gender: "MALE", isDeleted: false, ...workspaceFilter },
  });
  const femalePatients = await prisma.patient.count({
    where: { doctorId: doctor.id, gender: "FEMALE", isDeleted: false, ...workspaceFilter },
  });

  
  const topMedicines = await prisma.prescriptionMedicine.groupBy({
    by: ["snapshotBrandName", "snapshotGeneric"],
    where: {
      prescription: {
        doctorUserId: doctor.userId,
        isDeleted: false,
        ...workspaceFilter,
      },
    },
    _count: {
      id: true,
    },
    orderBy: {
      _count: {
        id: "desc",
      },
    },
    take: 5,
  });

  const formattedTopMedicines = topMedicines.map((med) => ({
    brandName: med.snapshotBrandName,
    generic: med.snapshotGeneric,
    prescriptionsCount: med._count.id,
  }));

  return {
    summary: {
      totalPatients,
      totalPrescriptions,
      totalChambers,
    },
    prescriptionsTrend: formattedTrend,
    lineTrend: formattedLineTrend,
    demographics: {
      male: malePatients,
      female: femalePatients,
      other: Math.max(0, totalPatients - (malePatients + femalePatients)),
    },
    topMedicines: formattedTopMedicines,
  };
};

const getInstitutionAnalytics = async (workspaceId: string) => {
  
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });

  if (!workspace) {
    throw createAppError("Workspace not found", Status.NOT_FOUND);
  }

  const inst = await prisma.institution.findUnique({
    where: { userId: workspace.ownerId },
  });

  if (!inst) {
    throw createAppError("Institution profile not found", Status.NOT_FOUND);
  }

  
  const totalDoctors = await prisma.institutionDoctor.count({
    where: { institutionId: inst.id, isActive: true },
  });

  
  const institutionWorkspaces = await prisma.workspace.findMany({
    where: { ownerId: inst.userId, type: WorkspaceType.INSTITUTION },
    select: { id: true },
  });
  const institutionWorkspaceIds = institutionWorkspaces.map((w) => w.id);
  const totalChambers = institutionWorkspaceIds.length
    ? await prisma.chamber.count({
        where: {
          workspaceId: { in: institutionWorkspaceIds },
          isActive: true,
        },
      })
    : 0;

  
  const totalPrescriptions = institutionWorkspaceIds.length
    ? await prisma.prescription.count({
        where: {
          workspaceId: { in: institutionWorkspaceIds },
          isDeleted: false,
        },
      })
    : 0;

  
  const totalPatients = institutionWorkspaceIds.length
    ? await prisma.patient.count({
        where: {
          workspaceId: { in: institutionWorkspaceIds },
          isDeleted: false,
        },
      })
    : 0;

  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const prescriptions = institutionWorkspaceIds.length
    ? await prisma.prescription.findMany({
        where: {
          workspaceId: { in: institutionWorkspaceIds },
          isDeleted: false,
          createdAt: { gte: sevenDaysAgo },
        },
        select: {
          createdAt: true,
        },
      })
    : [];

  const trendMap: { [key: string]: number } = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0] as string;
    trendMap[dateStr] = 0;
  }

  prescriptions.forEach((item) => {
    const dateStr = item.createdAt.toISOString().split("T")[0] as string;
    if (trendMap[dateStr] !== undefined) {
      trendMap[dateStr] += 1;
    }
  });

  const formattedTrend = Object.keys(trendMap)
    .sort()
    .map((date) => ({
      date,
      count: trendMap[date],
    }));

  
  
  
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
  const linePrescriptions = institutionWorkspaceIds.length
    ? await prisma.prescription.findMany({
        where: {
          workspaceId: { in: institutionWorkspaceIds },
          isDeleted: false,
          createdAt: { gte: fifteenDaysAgo },
        },
        select: { createdAt: true },
      })
    : [];

  const lineMap: { [key: string]: number } = {};
  for (let i = 0; i < 15; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    lineMap[d.toISOString().split("T")[0] as string] = 0;
  }
  linePrescriptions.forEach((item) => {
    const dateStr = item.createdAt.toISOString().split("T")[0] as string;
    if (lineMap[dateStr] !== undefined) lineMap[dateStr] += 1;
  });
  const formattedLineTrend = Object.keys(lineMap)
    .sort()
    .map((date) => ({ date, count: lineMap[date] }));

  
  const malePatients = institutionWorkspaceIds.length
    ? await prisma.patient.count({
        where: { workspaceId: { in: institutionWorkspaceIds }, gender: "MALE", isDeleted: false },
      })
    : 0;
  const femalePatients = institutionWorkspaceIds.length
    ? await prisma.patient.count({
        where: { workspaceId: { in: institutionWorkspaceIds }, gender: "FEMALE", isDeleted: false },
      })
    : 0;

  return {
    summary: {
      totalDoctors,
      totalChambers,
      totalPrescriptions,
      totalPatients,
    },
    prescriptionsTrend: formattedTrend,
    lineTrend: formattedLineTrend,
    demographics: {
      male: malePatients,
      female: femalePatients,
      other: Math.max(0, totalPatients - (malePatients + femalePatients)),
    },
    topMedicines: [],
  };
};

export const AnalyticsServices = {
  getDoctorAnalytics,
  getInstitutionAnalytics,
};
