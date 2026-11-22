import type { Cs_Service } from "../cs_types";
import { Cs_AppError } from "../utils/cs_appError";
import { CS_CATEGORIES, CS_SERVICE_MODES } from "../utils/cs_constants";

export type Cs_ServiceInput = Pick<
  Cs_Service,
  "title" | "category" | "description" | "image" | "basePrice" | "estimatedDuration" | "serviceMode" | "serviceArea"
>;

type Cs_FieldRule = (cs_value: unknown) => string | null;

const cs_text =
  (cs_label: string, cs_min: number, cs_max: number): Cs_FieldRule =>
  (cs_value) => {
    if (typeof cs_value !== "string" || !cs_value.trim()) return `${cs_label} is required`;
    const cs_length = cs_value.trim().length;
    if (cs_length < cs_min) return `${cs_label} must be at least ${cs_min} characters`;
    if (cs_length > cs_max) return `${cs_label} must be at most ${cs_max} characters`;
    return null;
  };

const cs_oneOf =
  (cs_label: string, cs_options: readonly string[]): Cs_FieldRule =>
  (cs_value) =>
    typeof cs_value === "string" && cs_options.includes(cs_value) ? null : `${cs_label} must be one of: ${cs_options.join(", ")}`;

const CS_SERVICE_RULES: Record<keyof Cs_ServiceInput, Cs_FieldRule> = {
  title: cs_text("Title", 3, 100),
  category: cs_oneOf("Category", CS_CATEGORIES),
  description: cs_text("Description", 20, 2000),
  image: (cs_value) =>
    typeof cs_value === "string" && /^https?:\/\/\S+$/i.test(cs_value.trim()) ? null : "Image must be a valid URL",
  basePrice: (cs_value) =>
    typeof cs_value === "number" && Number.isFinite(cs_value) && cs_value > 0 && cs_value <= 100000
      ? null
      : "Base price must be a number greater than 0",
  estimatedDuration: cs_text("Estimated duration", 1, 50),
  serviceMode: cs_oneOf("Service mode", CS_SERVICE_MODES),
  serviceArea: cs_text("Service area", 2, 100),
};

// Whitelists fields; partial = only the fields sent
export const cs_validateServiceInput = (cs_body: unknown, cs_partial = false): Partial<Cs_ServiceInput> => {
  const cs_source = (cs_body && typeof cs_body === "object" ? cs_body : {}) as Record<string, unknown>;
  const cs_clean: Record<string, unknown> = {};
  const cs_errors: string[] = [];

  for (const [cs_field, cs_rule] of Object.entries(CS_SERVICE_RULES)) {
    const cs_value = cs_source[cs_field];
    if (cs_partial && cs_value === undefined) continue;
    const cs_error = cs_rule(cs_value);
    if (cs_error) cs_errors.push(cs_error);
    else cs_clean[cs_field] = typeof cs_value === "string" ? cs_value.trim() : cs_value;
  }

  if (cs_errors.length) throw new Cs_AppError(400, cs_errors.join(". "));
  if (!Object.keys(cs_clean).length) throw new Cs_AppError(400, "Nothing to update");

  return cs_clean as Partial<Cs_ServiceInput>;
};
