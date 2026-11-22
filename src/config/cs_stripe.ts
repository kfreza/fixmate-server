import Stripe from "stripe";

let cs_stripe: Stripe | null = null;

// Created on first use, so the server can boot without Stripe keys
export const cs_getStripe = () => {
  if (cs_stripe) return cs_stripe;
  const cs_key = process.env.CS_STRIPE_SECRET_KEY;
  if (!cs_key) throw new Error("CS_STRIPE_SECRET_KEY is not set");
  cs_stripe = new Stripe(cs_key);
  return cs_stripe;
};
