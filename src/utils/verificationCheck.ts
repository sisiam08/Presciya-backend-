import { prisma } from "../lib/prisma";
import { VerificationStatus } from "../../generated/prisma/enums";
import { createAppError } from "../errors/appError";
import { Status } from "../errors/httpStatus";

export const checkUserVerification = async (userId: string): Promise<void> => {
  // Check if user is a doctor
  const doctor = await prisma.doctor.findUnique({
    where: { userId },
    select: { verificationStatus: true, name: true },
  });

  if (doctor) {
    if (doctor.verificationStatus !== VerificationStatus.APPROVED) {
      throw createAppError(
        `Your doctor profile is not verified yet. Current status: ${doctor.verificationStatus}. You can only view data, but cannot perform any write operations until your profile is approved.`,
        Status.FORBIDDEN,
        true,
        "VERIFICATION_REQUIRED",
      );
    }
    return;
  }

  // Check if user is an institution
  const institution = await prisma.institution.findUnique({
    where: { userId },
    select: { verificationStatus: true, name: true },
  });

  if (institution) {
    if (institution.verificationStatus !== VerificationStatus.APPROVED) {
      throw createAppError(
        `Your institution profile is not verified yet. Current status: ${institution.verificationStatus}. You can only view data, but cannot perform any write operations until your profile is approved.`,
        Status.FORBIDDEN,
        true,
        "VERIFICATION_REQUIRED",
      );
    }
    return;
  }
};
