import { DoctorType } from "../../generated/prisma/enums";

export interface IDoctorProfileData {
  name: string;
  userId?: string;
  qualification: string;
  specialization: string;
  registrationNo: string;
  signature?: string;
  type?: DoctorType;
}
