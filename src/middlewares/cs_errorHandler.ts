import type { ErrorRequestHandler, RequestHandler } from "express";
import { Cs_AppError } from "../utils/cs_appError";

// Unknown route → 404 JSON
export const cs_notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new Cs_AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

// Global error handler (Express 5 forwards async errors here)
export const cs_errorHandler: ErrorRequestHandler = (cs_error, _req, res, _next) => {
  let cs_statusCode = 500;
  let cs_message = "Something went wrong. Please try again later.";

  if (cs_error instanceof Cs_AppError) {
    cs_statusCode = cs_error.cs_statusCode;
    cs_message = cs_error.message;
  } else if (cs_error?.type === "entity.parse.failed") {
    cs_statusCode = 400;
    cs_message = "Invalid JSON in request body";
  } else if (cs_error?.code === 11000) {
    // Mongo duplicate key
    cs_statusCode = 409;
    cs_message = "Duplicate record";
  }

  if (cs_statusCode >= 500) {
    console.error(cs_error);
  }

  res.status(cs_statusCode).json({ success: false, message: cs_message });
};
