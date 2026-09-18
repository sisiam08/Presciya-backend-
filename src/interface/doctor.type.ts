import {
  PrescriptionLanguage,
  PrescriptionDesignTemplate,
} from "../../generated/prisma/enums";
import { IContactType } from "./contact.type";

export interface IUpdateDoctorProfile {
  name?: string;
  phone?: IContactType[];
  image?: string;
  qualification?: string;
  specialization?: string;
  designation?: string;
  registrationNo?: string;
  signature?: string;
  signatureUrl?: string;
  // Prescription rendering defaults (Settings → Prescription).
  prescriptionLanguage?: PrescriptionLanguage;
  prescriptionTemplate?: PrescriptionDesignTemplate;
}

export interface IAssignDoctor {
  name: string;
  email: string;
  dummyPassword: string;
  institutionalId: string;
  departmentId: string;
}
