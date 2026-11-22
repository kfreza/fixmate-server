import type { RequestHandler } from "express";
import type Stripe from "stripe";
import { cs_getStripe } from "../config/cs_stripe";
import { Cs_AppError } from "../utils/cs_appError";
import { cs_fulfillPayment } from "../utils/cs_fulfillPayment";

const CS_FULFIL_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);

// POST /api/payments/webhook (raw body, called by Stripe)
export const cs_handleStripeWebhook: RequestHandler = async (req, res) => {
  const cs_secret = process.env.CS_STRIPE_WEBHOOK_SECRET;
  if (!cs_secret) throw new Error("CS_STRIPE_WEBHOOK_SECRET is not set");

  const cs_signature = req.headers["stripe-signature"];
  if (typeof cs_signature !== "string" || !Buffer.isBuffer(req.body)) {
    throw new Cs_AppError(400, "Missing Stripe signature or raw body");
  }

  let cs_event: Stripe.Event;
  try {
    cs_event = cs_getStripe().webhooks.constructEvent(req.body, cs_signature, cs_secret);
  } catch {
    throw new Cs_AppError(400, "Invalid Stripe signature");
  }

  if (CS_FULFIL_EVENTS.has(cs_event.type)) {
    const cs_session = cs_event.data.object as Stripe.Checkout.Session;
    // Card payments are paid here; delayed methods arrive later as async_payment_succeeded
    if (cs_session.payment_status === "paid") {
      try {
        const { alreadyRecorded: cs_alreadyRecorded } = await cs_fulfillPayment(cs_session);
        console.log(`Webhook ${cs_event.type}: ${cs_session.id} ${cs_alreadyRecorded ? "already recorded" : "recorded"}`);
      } catch (cs_error) {
        // Our own data problem: a retry cannot fix it, so log and accept
        if (cs_error instanceof Cs_AppError) {
          console.error(`Webhook ${cs_event.type} for ${cs_session.id} skipped: ${cs_error.message}`);
        } else {
          // Temporary failure (e.g. database down): 500 makes Stripe retry
          throw cs_error;
        }
      }
    }
  }

  // Other event types are acknowledged so Stripe stops sending them
  res.json({ received: true });
};
