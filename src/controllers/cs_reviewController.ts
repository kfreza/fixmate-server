import type { RequestHandler } from "express";
import { ObjectId } from "mongodb";
import { cs_bookingsCollection, cs_servicesCollection } from "../config/cs_db";
import { Cs_AppError } from "../utils/cs_appError";
import { CS_PUBLIC_SERVICE_FILTER } from "../utils/cs_constants";
import { cs_toObjectId } from "../utils/cs_query";
import { cs_getAuthUser } from "../utils/cs_request";

const CS_REVIEW_MAX = 500;
const CS_REVIEWS_LIMIT = 10;

// Recount from the bookings, so the average can never drift
const cs_refreshServiceRating = async (cs_serviceId: string) => {
  if (!ObjectId.isValid(cs_serviceId)) return;
  const [cs_result] = await (await cs_bookingsCollection())
    .aggregate<{ avg: number; count: number }>([
      { $match: { serviceId: cs_serviceId, rating: { $exists: true } } },
      { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ])
    .toArray();
  await (await cs_servicesCollection()).updateOne(
    { _id: new ObjectId(cs_serviceId) },
    { $set: { avgRating: cs_result ? Math.round(cs_result.avg * 10) / 10 : 0, reviewCount: cs_result?.count ?? 0 } },
  );
};

// PATCH /api/bookings/:id/review { rating, review? } (customer, paid bookings, once)
export const cs_addReview: RequestHandler = async (req, res) => {
  const cs_user = cs_getAuthUser(req);
  const cs_bookingId = cs_toObjectId(req.params.id, "Booking not found");
  const cs_body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;

  const cs_rating = cs_body.rating;
  if (typeof cs_rating !== "number" || !Number.isInteger(cs_rating) || cs_rating < 1 || cs_rating > 5) {
    throw new Cs_AppError(400, "Rating must be a whole number from 1 to 5");
  }
  if (cs_body.review !== undefined && typeof cs_body.review !== "string") throw new Cs_AppError(400, "Review must be text");
  const cs_review = typeof cs_body.review === "string" ? cs_body.review.trim() : "";
  if (cs_review.length > CS_REVIEW_MAX) throw new Cs_AppError(400, `Review must be at most ${CS_REVIEW_MAX} characters`);

  const cs_bookings = await cs_bookingsCollection();
  const cs_booking = await cs_bookings.findOne({ _id: cs_bookingId });
  if (!cs_booking) throw new Cs_AppError(404, "Booking not found");
  if (cs_booking.customerEmail !== cs_user.email) throw new Cs_AppError(403, "Forbidden: this booking is not yours");
  if (cs_booking.paymentStatus !== "paid") throw new Cs_AppError(400, "You can review a job only after paying for it");

  // Atomic: a second (or parallel) review finds nothing to update
  const cs_updated = await cs_bookings.findOneAndUpdate(
    { _id: cs_bookingId, customerEmail: cs_user.email, paymentStatus: "paid", rating: { $exists: false } },
    { $set: { rating: cs_rating, ...(cs_review ? { review: cs_review } : {}), reviewedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!cs_updated) throw new Cs_AppError(409, "You have already reviewed this job");

  await cs_refreshServiceRating(cs_booking.serviceId);
  res.json({ success: true, message: "Thanks for your review!", booking: cs_updated });
};

// GET /api/services/:id/reviews (public, latest first)
export const cs_getServiceReviews: RequestHandler = async (req, res) => {
  const cs_serviceId = cs_toObjectId(req.params.id, "Service not found");
  const cs_service = await (await cs_servicesCollection()).findOne(
    { _id: cs_serviceId, ...CS_PUBLIC_SERVICE_FILTER },
    { projection: { avgRating: 1, reviewCount: 1 } },
  );
  if (!cs_service) throw new Cs_AppError(404, "Service not found");

  const cs_rows = await (await cs_bookingsCollection())
    .find(
      { serviceId: cs_serviceId.toString(), rating: { $exists: true } },
      { projection: { customerName: 1, rating: 1, review: 1, reviewedAt: 1 } },
    )
    .sort({ reviewedAt: -1, _id: -1 })
    .limit(CS_REVIEWS_LIMIT)
    .toArray();

  // First name only: reviews are public
  const cs_items = cs_rows.map((cs_row) => ({
    _id: cs_row._id,
    customerName: (cs_row.customerName ?? "Customer").split(" ")[0],
    rating: cs_row.rating,
    review: cs_row.review ?? "",
    reviewedAt: cs_row.reviewedAt,
  }));
  res.json({ success: true, avgRating: cs_service.avgRating ?? 0, reviewCount: cs_service.reviewCount ?? 0, items: cs_items });
};
