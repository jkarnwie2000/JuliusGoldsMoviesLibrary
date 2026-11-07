// GET /api/checkout-session?session_id=cs_...  — confirms a completed payment
// for the order confirmation page.
import Stripe from "stripe";

const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]+$/;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: "Payments are not set up yet." });
  }

  const id = req.query?.session_id;
  if (typeof id !== "string" || !SESSION_ID.test(id)) {
    return res.status(400).json({ error: "Invalid order reference." });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(id);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      paymentStatus: session.payment_status, // "paid" | "unpaid" | "no_payment_required"
      amountTotal: session.amount_total,
      currency: session.currency,
      email: session.customer_details?.email || null,
    });
  } catch (err) {
    console.error("Stripe session lookup error:", err.message);
    return res.status(404).json({ error: "We couldn't find that order." });
  }
}
