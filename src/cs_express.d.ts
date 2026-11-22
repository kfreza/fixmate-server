import type { Cs_AuthUser } from "./cs_types";

// Adds req.cs_user (set by verifyToken)
declare global {
  namespace Express {
    interface Request {
      cs_user?: Cs_AuthUser;
    }
  }
}

export {};
