import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { cs_usersCollection } from "../config/cs_db";
import { Cs_AppError } from "../utils/cs_appError";
import type { Cs_Role, Cs_TokenPayload } from "../cs_types";

// 401 if token missing/invalid; role is always read fresh from DB
export const verifyToken: RequestHandler = async (req, _res, next) => {
  const cs_header = req.headers.authorization;
  if (!cs_header?.startsWith("Bearer ")) {
    throw new Cs_AppError(401, "Unauthorized: token missing");
  }

  const cs_secret = process.env.CS_JWT_SECRET;
  if (!cs_secret) {
    throw new Error("CS_JWT_SECRET is not set");
  }

  let cs_payload: Cs_TokenPayload;
  try {
    cs_payload = jwt.verify(cs_header.slice(7), cs_secret, {
      algorithms: ["HS256"],
    }) as Cs_TokenPayload;
  } catch (cs_error) {
    const cs_expired = cs_error instanceof jwt.TokenExpiredError;
    throw new Cs_AppError(401, cs_expired ? "Unauthorized: token expired" : "Unauthorized: invalid token");
  }

  if (!cs_payload?.email) {
    throw new Cs_AppError(401, "Unauthorized: invalid token");
  }

  const cs_user = await (await cs_usersCollection()).findOne({ email: cs_payload.email });
  if (!cs_user) {
    throw new Cs_AppError(401, "Unauthorized: user not found");
  }

  req.cs_user = {
    _id: cs_user._id.toString(),
    name: cs_user.name,
    email: cs_user.email,
    image: cs_user.image,
    role: cs_user.role || "customer",
  };
  next();
};

// 403 if logged-in user has the wrong role
const cs_requireRole =
  (cs_role: Cs_Role): RequestHandler =>
  (req, _res, next) => {
    if (!req.cs_user) {
      throw new Cs_AppError(401, "Unauthorized");
    }
    if (req.cs_user.role !== cs_role) {
      throw new Cs_AppError(403, `Forbidden: ${cs_role} access only`);
    }
    next();
  };

export const verifyCustomer = cs_requireRole("customer");
export const verifyTechnician = cs_requireRole("technician");
export const verifyAdmin = cs_requireRole("admin");
