import type { CorsOptions } from "cors";
import { Cs_AppError } from "../utils/cs_appError";

const cs_normalizeOrigin = (cs_origin: string) => cs_origin.trim().replace(/\/+$/, "");

// CS_CORS_ORIGINS (comma separated) + CS_CLIENT_URL
const cs_getAllowedOrigins = (): string[] => {
  const cs_list = (process.env.CS_CORS_ORIGINS || "")
    .split(",")
    .concat(process.env.CS_CLIENT_URL || "")
    .map(cs_normalizeOrigin)
    .filter(Boolean);
  return [...new Set(cs_list)];
};

export const cs_corsOptions: CorsOptions = {
  origin: (cs_origin, cs_callback) => {
    // No origin = non-browser request (Postman, Stripe webhook)
    if (!cs_origin) return cs_callback(null, true);

    if (cs_getAllowedOrigins().includes(cs_normalizeOrigin(cs_origin))) {
      return cs_callback(null, true);
    }
    return cs_callback(new Cs_AppError(403, `Origin ${cs_origin} is not allowed by CORS`));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
