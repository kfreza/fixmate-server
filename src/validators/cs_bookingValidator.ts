import { Cs_AppError } from "../utils/cs_appError";
import { CS_BOOKING_MAX_DAYS_AHEAD, CS_TIMEZONE } from "../utils/cs_constants";

export interface Cs_BookingInput {
  serviceId: string;
  customerPhone: string;
  address: string;
  preferredDate: Date;
  problemDescription: string;
}

const CS_OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;
const CS_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
// Optional +, then 7 to 15 digits; spaces and dashes allowed
const CS_PHONE_REGEX = /^\+?\d{7,15}$/;

// YYYY-MM-DD for a date in Dhaka time
const cs_toDhakaDay = (cs_date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: CS_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    cs_date,
  );

const cs_readText = (cs_value: unknown) => (typeof cs_value === "string" ? cs_value.trim() : "");

// Whitelists the request form fields; everything else comes from the token and the service
export const cs_validateBookingInput = (cs_body: unknown): Cs_BookingInput => {
  const cs_source = (cs_body && typeof cs_body === "object" ? cs_body : {}) as Record<string, unknown>;
  const cs_errors: string[] = [];

  const cs_serviceId = cs_readText(cs_source.serviceId);
  if (!CS_OBJECT_ID_REGEX.test(cs_serviceId)) cs_errors.push("A valid serviceId is required");

  const cs_phone = cs_readText(cs_source.customerPhone).replace(/[\s-]/g, "");
  if (!CS_PHONE_REGEX.test(cs_phone)) cs_errors.push("Phone number must have 7 to 15 digits");

  const cs_address = cs_readText(cs_source.address);
  if (cs_address.length < 5 || cs_address.length > 300) cs_errors.push("Address must be 5 to 300 characters");

  const cs_problem = cs_readText(cs_source.problemDescription);
  if (cs_problem.length < 20) cs_errors.push("Problem description must be at least 20 characters");
  else if (cs_problem.length > 1000) cs_errors.push("Problem description must be at most 1000 characters");

  // Compare calendar days as strings, so time zones cannot shift them
  const cs_day = cs_readText(cs_source.preferredDate);
  const cs_date = new Date(`${cs_day}T00:00:00.000Z`);
  const cs_today = cs_toDhakaDay(new Date());
  const cs_lastDay = cs_toDhakaDay(new Date(Date.now() + CS_BOOKING_MAX_DAYS_AHEAD * 86_400_000));
  if (!CS_DATE_REGEX.test(cs_day) || Number.isNaN(cs_date.getTime()) || cs_date.toISOString().slice(0, 10) !== cs_day) {
    cs_errors.push("Preferred date must be a valid date (YYYY-MM-DD)");
  } else if (cs_day < cs_today) {
    cs_errors.push("Preferred date must be today or later");
  } else if (cs_day > cs_lastDay) {
    cs_errors.push(`Preferred date must be within ${CS_BOOKING_MAX_DAYS_AHEAD} days`);
  }

  if (cs_errors.length) throw new Cs_AppError(400, cs_errors.join(". "));

  return {
    serviceId: cs_serviceId,
    customerPhone: cs_phone,
    address: cs_address,
    preferredDate: cs_date,
    problemDescription: cs_problem,
  };
};
