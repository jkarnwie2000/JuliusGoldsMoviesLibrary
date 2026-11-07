// Admin API (requires a signed-in admin account; see api/auth.mjs).
//   GET  /api/admin                                   -> recent paid orders + setup status
//                                                        (also connects the Stripe webhook if it's missing)
//   POST /api/admin { action: "connect-webhook" }      -> registers the Stripe webhook that sends order emails
//   POST /api/admin { action: "resend-emails", orderId } -> re-sends the buyer + business emails for an order
// The session token is sent as "Authorization: Bearer <token>".
import Stripe from "stripe";
import { AuthError, verifySession } from "./_lib/auth.mjs";
import { sendOrderEmails } from "./_lib/email.mjs";
import { getOrder, listPaidOrders } from "./_lib/orders.mjs";

const WEBHOOK_EVENTS = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];
const ORDER_ID = /^cs_(test|live)_[A-Za-z0-9]+$/;

function siteOrigin(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  return `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;
}

// Finds the webhook for this site, creating it if it doesn't exist yet.
async function ensureWebhook(stripe, url) {
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = endpoints.data.find((e) => e.url === url && e.status === "enabled");
  if (existing) return { webhook: existing, created: false };
  const webhook = await stripe.webhookEndpoints.create({
    url,
    enabled_events: WEBHOOK_EVENTS,
    description: "Julius Gold's Movies: order confirmation emails",
  });
  console.log("Connected Stripe webhook:", url);
  return { webhook, created: true };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  let admin;
  try {
    admin = await verifySession(req.headers.authorization);
  } catch (err) {
    if (err instanceof AuthError) return res.status(err.status).json({ error: err.message });
    console.error("Admin auth error:", err.message);
    return res.status(500).json({ error: "Couldn't verify your sign-in." });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: "Stripe is not configured." });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const webhookUrl = `${siteOrigin(req)}/api/stripe-webhook`;
  const action = req.method === "POST" ? req.body?.action : null;

  try {
    if (action === "connect-webhook") {
      await ensureWebhook(stripe, webhookUrl);
      return res.status(200).json({ connected: true, url: webhookUrl });
    }

    if (action === "resend-emails") {
      const orderId = req.body?.orderId;
      if (typeof orderId !== "string" || !ORDER_ID.test(orderId)) {
        return res.status(400).json({ error: "Invalid order." });
      }
      if (!process.env.RESEND_API_KEY) {
        return res.status(503).json({ error: "Email sending isn't set up (RESEND_API_KEY)." });
      }
      const order = await getOrder(stripe, orderId);
      if (order.paymentStatus !== "paid" && order.paymentStatus !== "no_payment_required") {
        return res.status(400).json({ error: "That order hasn't been paid." });
      }
      const result = await sendOrderEmails(order, { tag: `resend-${Date.now()}` });
      return res.status(result.sent > 0 ? 200 : 502).json(result);
    }

    if (req.method !== "GET") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const [orders, hook] = await Promise.all([
      listPaidOrders(stripe, 100),
      ensureWebhook(stripe, webhookUrl).catch((err) => {
        console.error("Couldn't connect Stripe webhook:", err.message);
        return { webhook: null, created: false };
      }),
    ]);
    return res.status(200).json({
      signedInAs: admin.email,
      orders,
      setup: {
        stripeMode: process.env.STRIPE_SECRET_KEY.startsWith("sk_live") ? "live" : "test",
        emailsConfigured: Boolean(process.env.RESEND_API_KEY),
        businessEmail: process.env.BUSINESS_EMAIL || null,
        customSender: Boolean(process.env.EMAIL_FROM),
        webhookConnected: Boolean(hook.webhook),
        webhookJustConnected: hook.created,
        webhookUrl,
      },
    });
  } catch (err) {
    console.error("Admin API error:", err.message);
    return res.status(500).json({ error: "Couldn't load data from Stripe." });
  }
}
