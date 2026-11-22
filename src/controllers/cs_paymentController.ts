import type { RequestHandler } from "express";
import { cs_bookingsCollection } from "../config/cs_db";
import { cs_getStripe } from "../config/cs_stripe";
import { Cs_AppError } from "../utils/cs_appError";
import { cs_toObjectId } from "../utils/cs_query";
import { cs_getAuthUser } from "../utils/cs_request";

const CS_MIN_CHARGE_CENTS = 50;

// POST /api/payments/create-checkout-session { bookingId } (customer)
export const cs_createCheckoutSession: RequestHandler = async (req, res) => {
  const cs_user = cs_getAuthUser(req);
  const cs_bookingId = cs_toObjectId((req.body as { bookingId?: unknown } | undefined)?.bookingId, "Booking not found");

  // Only the owner's booking; 404 hides other people's bookings
  const cs_booking = await (await cs_bookingsCollection()).findOne({ _id: cs_bookingId, customerEmail: cs_user.email });
  if (!cs_booking) throw new Cs_AppError(404, "Booking not found");
  if (cs_booking.paymentStatus === "paid") throw new Cs_AppError(409, "This booking is already paid");
  if (cs_booking.status !== "completed") throw new Cs_AppError(400, "You can pay only after the job is completed");

  // The amount always comes from the database, never from the client
  const cs_amountCents = Math.round(cs_booking.finalAmount * 100);
  if (!Number.isFinite(cs_amountCents) || cs_amountCents < CS_MIN_CHARGE_CENTS) {
    throw new Cs_AppError(400, "The final amount for this booking is not valid");
  }

  const cs_clientUrl = (process.env.CS_CLIENT_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const cs_id = cs_bookingId.toString();

  const cs_session = await cs_getStripe().checkout.sessions.create({
    mode: "payment",
    customer_email: cs_booking.customerEmail,
    client_reference_id: cs_id,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: cs_amountCents,
          product_data: {
            name: cs_booking.serviceTitle,
            description: `Repair by ${cs_booking.technicianName}`,
            ...(cs_booking.serviceImage?.startsWith("https://") ? { images: [cs_booking.serviceImage] } : {}),
          },
        },
      },
    ],
    // Read back by verify and the webhook
    metadata: { bookingId: cs_id, customerEmail: cs_booking.customerEmail },
    payment_intent_data: { metadata: { bookingId: cs_id } },
    success_url: `${cs_clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${cs_clientUrl}/payment/cancel?booking_id=${cs_id}`,
  });

  if (!cs_session.url) throw new Error("Stripe did not return a checkout URL");
  res.status(201).json({ success: true, url: cs_session.url, sessionId: cs_session.id });
};
