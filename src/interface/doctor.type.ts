import { IContactType } from "./contact.type";

export interface IUpdateDoctorProfile {
  name?: string;
  phone?: IContactType[];
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
}
