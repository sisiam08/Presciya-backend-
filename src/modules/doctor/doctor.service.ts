import bcrypt from "bcryptjs";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import { IAssignDoctor, IUpdateDoctorProfile } from "../../interface";
import { prisma } from "../../lib/prisma";

const assignDoctor = async (doctorData: IAssignDoctor) => {
  const { name, email, password, institutionalId, role, type } = doctorData;

  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    throw createAppError("User already exists", Status.CONFLICT);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    await tx.doctor.create({
      data: {
        name: user.name,
        userId: user.id,
        institutionalId,
        type,
      },
    });

    return user;
  });
};

const getDoctorProfile = async (userId: string) => {
  return await prisma.doctor.findUnique({
    where: {
      userId,
    },
  });
};

const getDoctorProfileById = async (doctorId: string) => {
  return await prisma.doctor.findUnique({
    where: {
      id: doctorId,
    },
  });
};

const getAllDoctors = async () => {
  return await prisma.doctor.findMany();
};

const getMyDoctors = async (institutionalId: string) => {
  return await prisma.doctor.findMany({
    where: {
      institutionalId,
    },
  });
};

const updateDoctorProfile = async (
  data: IUpdateDoctorProfile,
  userId: string,
) => {
  return await prisma.doctor.update({
    where: {
      userId,
    },
    data,
  });
};

export const DoctorServices = {
  assignDoctor,
  getDoctorProfile,
  getDoctorProfileById,
  getMyDoctors,
  updateDoctorProfile,
  getAllDoctors,
};
