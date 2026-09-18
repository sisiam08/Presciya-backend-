export interface IPdfRenderData {
  id: string;
  createdAt: Date;
  status: string;
  // Rendering choices frozen per prescription. Default to ENGLISH / DEFAULT.
  language?: string | null;
  template?: string | null;
  complaints?: string | null;
  diagnosis?: string | null;
  bloodPressure?: string | null;
  pulse?: number | null;
  temperature?: number | null;
  weight?: number | null;
  height?: string | null;
  respiratoryRate?: number | null;
  clinicalNotes?: string | null;
  advises?: string | null;
  nextVisitDate?: Date | null;
  medicines: any[];
  doctor: {
    name: string;
    qualification?: string | null;
    specialization?: string | null;
    registrationNo?: string | null;
    signature?: string | null;
    // BMDC registration is only printed once the doctor is professionally
    // approved (Section 14.2).
    bmdcApproved?: boolean;
  };
  chamber?: {
    chamberName: string;
    chamberAddress: string;
    chamberEmail?: string | null;
    logo?: string | null;
    chamberSlogan?: string | null;
    templateConfig?: any;
    chamberPhone?: any[];
  } | null;
  patient: {
    name: string;
    age: number;
    gender: string;
    phone?: string | null;
    bloodGroup?: string | null;
    allergies?: string | null;
    chronicDiseases?: string | null;
    patientIdentifier?: string | null;
  };
  serialNumber?: string | null;
  verificationCode?: string | null;
}

export {};
