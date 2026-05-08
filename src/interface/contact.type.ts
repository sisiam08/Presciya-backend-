import { ContactLabel } from "../../generated/prisma/enums";

export interface ContactType {
  userId?: string;
  chamberId?: string;
  label: ContactLabel;
  phone: string;
  isPrimary: boolean;
}
