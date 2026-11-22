import type { Request } from "express";
import { Cs_AppError } from "./cs_appError";

// Logged-in user set by verifyToken
export const cs_getAuthUser = (req: Request) => {
  if (!req.cs_user) throw new Cs_AppError(401, "Unauthorized");
  return req.cs_user;
};
