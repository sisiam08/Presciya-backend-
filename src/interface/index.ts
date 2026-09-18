import { SystemRole, WorkspaceRole, WorkspaceType } from "../../generated/prisma/enums";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        systemRole: SystemRole;
        workspaceId?: string;
        workspaceType?: WorkspaceType;
        workspaceRole?: WorkspaceRole;
      };
    }
  }
}

export type * from "./router.type";
export type * from "./auth.type";
export type * from "./contact.type";
export type * from "./error.type";
export type * from "./response.type";
export type * from "./doctor.type";
