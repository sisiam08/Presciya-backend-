import bcrypt from "bcryptjs";
import { createAppError } from "../../errors/appError";
import { Status } from "../../errors/httpStatus";
import { IAssignDoctor, IUpdateDoctorProfile } from "../../interface";
import { prisma } from "../../lib/prisma";
import { DoctorType, UserRole } from "../../../generated/prisma/enums";

import { deleteFileFromCloudinary } from "../../config/cloudinary.config";

const assignDoctor = async (doctorData: IAssignDoctor) => {
  const { name, email, password, institutionalId } = doctorData;

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
        role: UserRole.DOCTOR_INSTITUTIONAL,
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
        type: DoctorType.INSTITUTIONAL,
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
  const { phone, image, ...rest } = data;
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      name: true,
      image: true,
      doctor: {
        select: {
          signature: true,
        },
      },
    },
  });

  return await prisma.$transaction(async (tx) => {
    // Delete old signature if a new one is provided (Decoupled to prevent blocking response)
    if (rest.signature && user?.doctor?.signature) {
      const oldSig = user.doctor.signature;
      setTimeout(() => {
        deleteFileFromCloudinary(oldSig).catch(console.error);
      }, 0);
    }
    
    // Delete old profile image if a new one is provided (Decoupled to prevent blocking response)
    if (image && user?.image) {
      const oldImg = user.image;
      setTimeout(() => {
        deleteFileFromCloudinary(oldImg).catch(console.error);
      }, 0);
    }

    const doctor = await tx.doctor.update({
      where: {
        userId,
      },
      data: rest,
    });

    if (user?.name !== doctor.name || image) {
      await tx.user.update({
        where: {
          id: userId,
        },
        data: {
          ...(user?.name !== doctor.name && { name: doctor.name }),
          ...(image && { image }),
        },
      });
    }

    if (phone) {
      await tx.contactNumber.createMany({
        data: phone.map((p) => ({
          ...p,
          userId: doctor.userId,
        })),
      });
    }

    return doctor;
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
