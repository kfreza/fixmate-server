import { ObjectId } from "mongodb";
import { Cs_AppError } from "./cs_appError";

// First string value of a query param
export const cs_queryString = (cs_value: unknown) => {
  const cs_first = Array.isArray(cs_value) ? cs_value[0] : cs_value;
  return typeof cs_first === "string" ? cs_first.trim() : "";
};

// Positive int with fallback and max
export const cs_queryInt = (cs_value: unknown, cs_fallback: number, cs_max = Number.MAX_SAFE_INTEGER) => {
  const cs_number = Number.parseInt(cs_queryString(cs_value), 10);
  if (!Number.isFinite(cs_number) || cs_number < 1) return cs_fallback;
  return Math.min(cs_number, cs_max);
};

// User text is matched literally, not as regex
export const cs_escapeRegex = (cs_text: string) => cs_text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Invalid id → 404 instead of a crash
export const cs_toObjectId = (cs_id: unknown, cs_notFoundMessage = "Not found") => {
  if (typeof cs_id !== "string" || !ObjectId.isValid(cs_id) || cs_id.length !== 24) {
    throw new Cs_AppError(404, cs_notFoundMessage);
  }
  return new ObjectId(cs_id);
};
