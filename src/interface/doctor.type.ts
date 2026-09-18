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
}

export interface IAssignDoctor {
  name: string;
  email: string;
  dummyPassword: string;
  institutionalId: string;
  departmentId: string;
}
