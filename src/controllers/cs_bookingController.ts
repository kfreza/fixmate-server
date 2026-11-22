import type { RequestHandler } from "express";
import { MongoServerError, ObjectId } from "mongodb";
import { cs_bookingsCollection, cs_servicesCollection } from "../config/cs_db";
import type { Cs_Booking } from "../cs_types";
import { Cs_AppError } from "../utils/cs_appError";
import { CS_ACTIVE_BOOKING_STATUSES, CS_PUBLIC_SERVICE_FILTER } from "../utils/cs_constants";
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
