import type { Cs_BookingStatus, Cs_ServiceCategory, Cs_ServiceMode } from "../cs_types";

export const CS_CATEGORIES: readonly Cs_ServiceCategory[] = [
  "Smartphone",
  "Laptop & PC",
  "AC",
  "Refrigerator",
  "TV",
  "Washing Machine",
  "Electrical",
];

export const CS_SERVICE_MODES: readonly Cs_ServiceMode[] = ["Home Visit", "Shop Drop-off"];

// Shown on public pages only
export const CS_PUBLIC_SERVICE_FILTER = { approvalStatus: "approved", isAvailable: true } as const;

export const CS_PAGE_LIMIT_DEFAULT = 9;
export const CS_PAGE_LIMIT_MAX = 24;
export const CS_FEATURED_LIMIT = 6;

// Bookings that still block a delete or a duplicate request
export const CS_ACTIVE_BOOKING_STATUSES: readonly Cs_BookingStatus[] = ["requested", "accepted", "in-progress"];

// Booking dates are checked in Dhaka time
export const CS_TIMEZONE = "Asia/Dhaka";
export const CS_BOOKING_MAX_DAYS_AHEAD = 90;

export const CS_BOOKING_STATUSES: readonly Cs_BookingStatus[] = [
  "requested",
  "accepted",
  "rejected",
  "in-progress",
  "completed",
  "cancelled",
];

// The only moves a technician can make (customer cancel is separate)
export const CS_ALLOWED_TRANSITIONS: Partial<Record<Cs_BookingStatus, readonly Cs_BookingStatus[]>> = {
  requested: ["accepted", "rejected"],
  accepted: ["in-progress"],
  "in-progress": ["completed"],
};

export const CS_MIN_FINAL_AMOUNT = 0.5;
export const CS_MAX_FINAL_AMOUNT = 100000;
