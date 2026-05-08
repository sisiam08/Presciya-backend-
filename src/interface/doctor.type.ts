import { DoctorType, UserRole } from "../../generated/prisma/enums";

export interface IUpdateDoctorProfile {
  name: string;
  qualification?: string;
  specialization?: string;
  registrationNo: string;
  signature?: string;
}

export interface IAssignDoctor {
  name: string;
  email: string;
  password: string;
  institutionalId: string;
  role: UserRole;
  type: DoctorType;
}
