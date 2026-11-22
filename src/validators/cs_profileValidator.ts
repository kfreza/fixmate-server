import { Cs_AppError } from "../utils/cs_appError";

export interface Cs_ProfileChanges {
  set: Partial<Record<"name" | "image" | "phone" | "area" | "bio", string>>;
  unset: ("image" | "phone" | "area" | "bio")[];
}

const CS_OPTIONAL_LIMITS = { area: 100, bio: 300 } as const;

// Whitelist; email and role are never read from the body
export const cs_validateProfileInput = (cs_body: unknown): Cs_ProfileChanges => {
  const cs_source = (cs_body && typeof cs_body === "object" ? cs_body : {}) as Record<string, unknown>;
  const cs_changes: Cs_ProfileChanges = { set: {}, unset: [] };
  const cs_errors: string[] = [];

  const cs_text = (cs_field: string) => {
    const cs_value = cs_source[cs_field];
    if (cs_value === undefined) return undefined;
    if (cs_value === null) return "";
    if (typeof cs_value !== "string") {
      cs_errors.push(`${cs_field} must be text`);
      return undefined;
    }
    return cs_value.trim();
  };

  const cs_name = cs_text("name");
  if (cs_name !== undefined) {
    if (cs_name.length < 2 || cs_name.length > 60) cs_errors.push("Name must be 2 to 60 characters");
    else cs_changes.set.name = cs_name;
  }

  // Empty string removes the photo
  const cs_image = cs_text("image");
  if (cs_image !== undefined) {
    if (!cs_image) cs_changes.unset.push("image");
    else if (!/^https:\/\/\S+$/i.test(cs_image) || cs_image.length > 500) cs_errors.push("Image must be a valid https URL");
    else cs_changes.set.image = cs_image;
  }

  const cs_phone = cs_text("phone");
  if (cs_phone !== undefined) {
    const cs_digits = cs_phone.replace(/[\s-]/g, "");
    if (!cs_digits) cs_changes.unset.push("phone");
    else if (!/^\+?\d{7,15}$/.test(cs_digits)) cs_errors.push("Phone number must have 7 to 15 digits");
    else cs_changes.set.phone = cs_digits;
  }

  for (const [cs_field, cs_max] of Object.entries(CS_OPTIONAL_LIMITS) as ["area" | "bio", number][]) {
    const cs_value = cs_text(cs_field);
    if (cs_value === undefined) continue;
    if (!cs_value) cs_changes.unset.push(cs_field);
    else if (cs_value.length > cs_max) cs_errors.push(`${cs_field === "bio" ? "Bio" : "Area"} must be at most ${cs_max} characters`);
    else cs_changes.set[cs_field] = cs_value;
  }

  if (cs_errors.length) throw new Cs_AppError(400, cs_errors.join(". "));
  if (!Object.keys(cs_changes.set).length && !cs_changes.unset.length) throw new Cs_AppError(400, "Nothing to update");
  return cs_changes;
};
