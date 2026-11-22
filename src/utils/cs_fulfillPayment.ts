import { MongoServerError, ObjectId } from "mongodb";
import type Stripe from "stripe";
import { cs_bookingsCollection, cs_paymentsCollection } from "../config/cs_db";
import type { Cs_Payment } from "../cs_types";
import { Cs_AppError } from "./cs_appError";

export interface Cs_FulfillResult {
  payment: Cs_Payment;
  alreadyRecorded: boolean;
}

// Shared by GET /verify and the webhook; safe to run any number of times
export const cs_fulfillPayment = async (cs_session: Stripe.Checkout.Session): Promise<Cs_FulfillResult> => {
  if (cs_session.payment_status !== "paid") {
    throw new Cs_AppError(402, "This payment is not completed yet");
  }

  const cs_bookingId = cs_session.metadata?.bookingId;
  if (!cs_bookingId || !ObjectId.isValid(cs_bookingId)) {
    throw new Cs_AppError(400, "This checkout session has no booking attached");
  }

  const cs_bookings = await cs_bookingsCollection();
  const cs_booking = await cs_bookings.findOne({ _id: new ObjectId(cs_bookingId) });
  if (!cs_booking) throw new Cs_AppError(404, "Booking not found");

  // Stripe's charged amount must match the price stored in our DB
  const cs_paidCents = cs_session.amount_total ?? -1;
  if (cs_paidCents !== Math.round(cs_booking.finalAmount * 100)) {
    console.error(`Amount mismatch for booking ${cs_bookingId}: paid ${cs_paidCents}, expected ${cs_booking.finalAmount}`);
    throw new Cs_AppError(409, "The paid amount does not match this booking. Please contact support.");
  }

  const cs_payments = await cs_paymentsCollection();
  const cs_payment: Cs_Payment = {
    bookingId: cs_bookingId,
    serviceTitle: cs_booking.serviceTitle,
    customerName: cs_booking.customerName,
    customerEmail: cs_booking.customerEmail,
    technicianName: cs_booking.technicianName,
    technicianEmail: cs_booking.technicianEmail,
    amount: cs_paidCents / 100,
    currency: "usd",
    transactionId:
      typeof cs_session.payment_intent === "string" ? cs_session.payment_intent : (cs_session.payment_intent?.id ?? ""),
    stripeSessionId: cs_session.id,
    paymentStatus: "paid",
    paidAt: new Date(),
  };

  // Unique stripeSessionId (and bookingId): a duplicate means it is already saved
  let cs_saved = cs_payment;
  let cs_alreadyRecorded = false;
  try {
    const { insertedId: cs_insertedId } = await cs_payments.insertOne(cs_payment);
    cs_saved = { ...cs_payment, _id: cs_insertedId };
  } catch (cs_error) {
    if (!(cs_error instanceof MongoServerError && cs_error.code === 11000)) throw cs_error;
    cs_alreadyRecorded = true;
    const cs_existing = await cs_payments.findOne({ $or: [{ stripeSessionId: cs_session.id }, { bookingId: cs_bookingId }] });
    if (cs_existing) cs_saved = cs_existing;
    if (cs_existing && cs_existing.stripeSessionId !== cs_session.id) {
      // Paid twice through two checkout tabs; needs a manual refund
      console.error(`Booking ${cs_bookingId} already paid by ${cs_existing.stripeSessionId}; extra session ${cs_session.id}`);
    }
  }

  // Runs every time, so a crash between the two writes heals itself
  await cs_bookings.updateOne(
    { _id: cs_booking._id, paymentStatus: "unpaid" },
    {
      $set: { paymentStatus: "paid" },
      $push: { statusHistory: { status: "paid", changedAt: cs_saved.paidAt } },
    },
  );

  return { payment: cs_saved, alreadyRecorded: cs_alreadyRecorded };
};
