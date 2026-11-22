import type { Request, RequestHandler } from "express";
import { MongoServerError, ObjectId, type Filter } from "mongodb";
import { cs_bookingsCollection, cs_servicesCollection } from "../config/cs_db";
import type { Cs_Booking, Cs_BookingStatus } from "../cs_types";
import { Cs_AppError } from "../utils/cs_appError";
import {
  CS_ACTIVE_BOOKING_STATUSES,
  CS_ALLOWED_TRANSITIONS,
  CS_BOOKING_STATUSES,
  CS_MAX_FINAL_AMOUNT,
  CS_MIN_FINAL_AMOUNT,
  CS_PUBLIC_SERVICE_FILTER,
} from "../utils/cs_constants";
import { cs_queryString, cs_toObjectId } from "../utils/cs_query";
import { cs_getAuthUser } from "../utils/cs_request";
import { cs_validateBookingInput } from "../validators/cs_bookingValidator";

const CS_DUPLICATE_MESSAGE = "You already have an active request for this service";

// POST /api/bookings (customer only)
export const cs_createBooking: RequestHandler = async (req, res) => {
  const cs_user = cs_getAuthUser(req);
  const cs_input = cs_validateBookingInput(req.body);

  const cs_service = await (await cs_servicesCollection()).findOne({
    _id: new ObjectId(cs_input.serviceId),
    ...CS_PUBLIC_SERVICE_FILTER,
  });
  if (!cs_service) throw new Cs_AppError(404, "Service not found or not available for booking");

  const cs_bookings = await cs_bookingsCollection();

  // Friendly early check; the unique index below is the real guard
  const cs_active = await cs_bookings.findOne(
    { serviceId: cs_input.serviceId, customerEmail: cs_user.email, status: { $in: [...CS_ACTIVE_BOOKING_STATUSES] } },
    { projection: { _id: 1 } },
  );
  if (cs_active) throw new Cs_AppError(409, CS_DUPLICATE_MESSAGE);

  const cs_now = new Date();
  const cs_booking: Cs_Booking = {
    serviceId: cs_input.serviceId,
    serviceTitle: cs_service.title,
    serviceImage: cs_service.image,
    category: cs_service.category,
    basePrice: cs_service.basePrice,
    technicianName: cs_service.technicianName,
    technicianEmail: cs_service.technicianEmail,
    customerName: cs_user.name,
    customerEmail: cs_user.email,
    customerPhone: cs_input.customerPhone,
    address: cs_input.address,
    preferredDate: cs_input.preferredDate,
    problemDescription: cs_input.problemDescription,
    status: "requested",
    finalAmount: cs_service.basePrice,
    paymentStatus: "unpaid",
    statusHistory: [{ status: "requested", changedAt: cs_now }],
    createdAt: cs_now,
  };

  try {
    const { insertedId: cs_insertedId } = await cs_bookings.insertOne(cs_booking);
    res.status(201).json({
      success: true,
      message: "Repair request sent to the technician",
      booking: { ...cs_booking, _id: cs_insertedId },
    });
  } catch (cs_error) {
    // Two requests at the same moment: the index lets only one in
    if (cs_error instanceof MongoServerError && cs_error.code === 11000) {
      throw new Cs_AppError(409, CS_DUPLICATE_MESSAGE);
    }
    throw cs_error;
  }
};

type Cs_OwnerField = "customerEmail" | "technicianEmail";

// Optional ?status= filter; unknown values are ignored
const cs_statusFilter = (req: Request) => {
  const cs_status = cs_queryString(req.query.status);
  return CS_BOOKING_STATUSES.includes(cs_status as Cs_BookingStatus) ? { status: cs_status as Cs_BookingStatus } : {};
};

// 404 if missing, 403 if it belongs to someone else
const cs_findOwnedBooking = async (req: Request, cs_field: Cs_OwnerField) => {
  const cs_user = cs_getAuthUser(req);
  const cs_bookingId = cs_toObjectId(req.params.id, "Booking not found");
  const cs_booking = await (await cs_bookingsCollection()).findOne({ _id: cs_bookingId });
  if (!cs_booking) throw new Cs_AppError(404, "Booking not found");
  if (cs_booking[cs_field] !== cs_user.email) {
    throw new Cs_AppError(403, "Forbidden: this booking is not yours");
  }
  return { ...cs_booking, _id: cs_bookingId };
};

// Updates only if the status is still what we read, so races cannot skip a step
const cs_moveStatus = async (
  cs_booking: Cs_Booking & { _id: ObjectId },
  cs_field: Cs_OwnerField,
  cs_next: Cs_BookingStatus,
  cs_extra: Partial<Cs_Booking> = {},
) => {
  const cs_filter: Filter<Cs_Booking> = {
    _id: cs_booking._id,
    [cs_field]: cs_booking[cs_field],
    status: cs_booking.status,
  };
  const cs_updated = await (await cs_bookingsCollection()).findOneAndUpdate(
    cs_filter,
    {
      $set: { ...cs_extra, status: cs_next },
      $push: { statusHistory: { status: cs_next, changedAt: new Date() } },
    },
    { returnDocument: "after" },
  );
  if (!cs_updated) throw new Cs_AppError(409, "This booking was just updated. Please refresh and try again.");
  return cs_updated;
};

// GET /api/bookings/my?status= (customer)
export const cs_getMyBookings: RequestHandler = async (req, res) => {
  const cs_user = cs_getAuthUser(req);
  const cs_items = await (await cs_bookingsCollection())
    .find({ customerEmail: cs_user.email, ...cs_statusFilter(req) })
    .sort({ createdAt: -1, _id: -1 })
    .toArray();
  res.json({ success: true, items: cs_items });
};

// GET /api/bookings/technician?status= (technician)
export const cs_getTechnicianBookings: RequestHandler = async (req, res) => {
  const cs_user = cs_getAuthUser(req);
  const cs_items = await (await cs_bookingsCollection())
    .find({ technicianEmail: cs_user.email, ...cs_statusFilter(req) })
    .sort({ createdAt: -1, _id: -1 })
    .toArray();
  res.json({ success: true, items: cs_items });
};

// PATCH /api/bookings/:id/cancel (customer, only while requested)
export const cs_cancelBooking: RequestHandler = async (req, res) => {
  const cs_booking = await cs_findOwnedBooking(req, "customerEmail");
  if (cs_booking.status !== "requested") {
    throw new Cs_AppError(400, `Only requested bookings can be cancelled. This one is ${cs_booking.status}.`);
  }
  const cs_updated = await cs_moveStatus(cs_booking, "customerEmail", "cancelled");
  res.json({ success: true, message: "Booking cancelled", booking: cs_updated });
};

// PATCH /api/bookings/:id/status { status, finalAmount? } (technician)
export const cs_updateBookingStatus: RequestHandler = async (req, res) => {
  const cs_body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
  const cs_next = cs_body.status as Cs_BookingStatus;
  if (!CS_BOOKING_STATUSES.includes(cs_next)) {
    throw new Cs_AppError(400, `Status must be one of: ${CS_BOOKING_STATUSES.join(", ")}`);
  }

  const cs_booking = await cs_findOwnedBooking(req, "technicianEmail");
  if (!CS_ALLOWED_TRANSITIONS[cs_booking.status]?.includes(cs_next)) {
    throw new Cs_AppError(400, `Cannot change a booking from ${cs_booking.status} to ${cs_next}`);
  }

  // The amount the customer will pay is fixed when the job is completed
  const cs_extra: Partial<Cs_Booking> = {};
  if (cs_next === "completed") {
    const cs_amount =
      typeof cs_body.finalAmount === "number" ? Math.round(cs_body.finalAmount * 100) / 100 : Number.NaN;
    // Stripe cannot charge less than 0.50 USD
    if (!Number.isFinite(cs_amount) || cs_amount < CS_MIN_FINAL_AMOUNT || cs_amount > CS_MAX_FINAL_AMOUNT) {
      throw new Cs_AppError(400, `Final amount must be between ${CS_MIN_FINAL_AMOUNT} and ${CS_MAX_FINAL_AMOUNT}`);
    }
    cs_extra.finalAmount = cs_amount;
  }

  const cs_updated = await cs_moveStatus(cs_booking, "technicianEmail", cs_next, cs_extra);
  res.json({ success: true, message: `Booking ${cs_next}`, booking: cs_updated });
};
