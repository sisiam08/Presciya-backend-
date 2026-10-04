export interface IPdfRenderData {
  id: string;
  createdAt: Date;
  status: string;
  
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
  
  history?: string | null;
  examRespiratoryRate?: string | null;
  examLungs?: string | null;
  examHeart?: string | null;
  examAnaemia?: string | null;
  examCyanosis?: string | null;
  examOedema?: string | null;
  examDehydration?: string | null;
  examOthers?: string | null;
  
  investigations?: Array<{ testName: string; note?: string | null }> | null;
  medicines: any[];
  doctor: {
    name: string;
    qualification?: string | null;
    specialization?: string | null;
    registrationNo?: string | null;
    signature?: string | null;
    
    
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
  
  qrVerificationAllowed?: boolean;
  
  footerText?: string | null;
  
  watermark?: {
    enabled: boolean;
    text?: string | null;
    url?: string | null;
  } | null;
}

export {};
