import { ContactLabel } from "../../generated/prisma/enums";

export interface IContactType {
  userId?: string;
  chamberId?: string;
  label: ContactLabel;
  phone: string;
  isPrimary: boolean;
}
