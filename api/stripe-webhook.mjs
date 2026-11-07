// POST /api/stripe-webhook — Stripe calls this when a checkout is paid.
// Sends the order confirmation to the buyer and a copy to the business.
//
// Security: we never trust the posted payload. We take only the event ID and
// fetch the event back from Stripe with our secret key, so a forged request
// can't trigger emails or fake an order.
import Stripe from "stripe";
import { getOrder } from "./_lib/orders.mjs";
import { businessEmail, buyerEmail, sendEmail } from "./_lib/email.mjs";

const HANDLED = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: "Stripe is not configured" });
  }

  const eventId = req.body?.id;
  if (typeof eventId !== "string" || !/^evt_[A-Za-z0-9]+$/.test(eventId)) {
    return res.status(400).json({ error: "Invalid event" });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let event;
  try {
    event = await stripe.events.retrieve(eventId);
  } catch {
    return res.status(400).json({ error: "Unknown event" });
  }

  if (!HANDLED.has(event.type)) return res.status(200).json({ received: true, ignored: event.type });

  const session = event.data.object;
  // Card payments are "paid" on completion; delayed methods arrive later as async_payment_succeeded.
  if (session.payment_status !== "paid") return res.status(200).json({ received: true, pending: true });

  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set; skipping order emails for", session.id);
    return res.status(200).json({ received: true, emailed: false });
  }

  const order = await getOrder(stripe, session.id);
  const sends = [];
  if (order.email) {
    const { subject, html } = buyerEmail(order);
    sends.push(
      sendEmail({
        to: order.email,
        subject,
        html,
        replyTo: process.env.BUSINESS_EMAIL,
        idempotencyKey: `order-${order.id}-buyer`,
      })
    );
  }
  if (process.env.BUSINESS_EMAIL) {
    const { subject, html } = businessEmail(order);
    sends.push(
      sendEmail({
        to: process.env.BUSINESS_EMAIL,
        subject,
        html,
        replyTo: order.email || undefined,
        idempotencyKey: `order-${order.id}-business`,
      })
    );
  }

  const results = await Promise.allSettled(sends);
  const failed = results.filter((r) => r.status === "rejected");
  failed.forEach((r) => console.error("Order email failed:", r.reason?.message));

  // If every email failed, return 500 so Stripe retries later (idempotency keys prevent duplicates).
  if (sends.length > 0 && failed.length === sends.length) {
    return res.status(500).json({ error: "Email delivery failed" });
  }
  return res.status(200).json({ received: true, emailed: sends.length - failed.length });
}
