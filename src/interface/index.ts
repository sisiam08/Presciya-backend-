declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        role: string;
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
