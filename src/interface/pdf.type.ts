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
  // Optional clinical free text: past history + On Examination (O/E) findings.
  history?: string | null;
  examRespiratoryRate?: string | null;
  examLungs?: string | null;
  examHeart?: string | null;
  examAnaemia?: string | null;
  examCyanosis?: string | null;
  examOedema?: string | null;
  examDehydration?: string | null;
  examOthers?: string | null;
  // Ordered list of requested tests.
  investigations?: Array<{ testName: string; note?: string | null }> | null;
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
  /**
   * Plan entitlement `qr_verification`. When explicitly `false` the QR block is
   * omitted from the rendered prescription. `undefined` (the historical
   * behaviour) keeps rendering the QR.
   */
  qrVerificationAllowed?: boolean;
  /** Custom prescription footer (chamber footerText or personal settings). */
  footerText?: string | null;
  /**
   * Resolved watermark for this prescription context (personal settings or
   * chamber settings). Disabled/empty means nothing is drawn.
   */
  watermark?: {
    enabled: boolean;
    text?: string | null;
    url?: string | null;
  } | null;
}

export {};
