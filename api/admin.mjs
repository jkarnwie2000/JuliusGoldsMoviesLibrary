// Admin API (requires a signed-in admin account; see api/auth.mjs).
//   GET  /api/admin                              -> recent paid orders + setup status
//   POST /api/admin { action: "connect-webhook" } -> registers the Stripe webhook that sends order emails
// The session token is sent as "Authorization: Bearer <token>".
import Stripe from "stripe";
import { AuthError, verifySession } from "./_lib/auth.mjs";
import { listPaidOrders } from "./_lib/orders.mjs";

const WEBHOOK_EVENTS = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];

function siteOrigin(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  return `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;
}

async function findWebhook(stripe, url) {
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  return endpoints.data.find((e) => e.url === url && e.status === "enabled");
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

  try {
    if (req.method === "POST" && req.body?.action === "connect-webhook") {
      const existing = await findWebhook(stripe, webhookUrl);
      if (!existing) {
        await stripe.webhookEndpoints.create({
          url: webhookUrl,
          enabled_events: WEBHOOK_EVENTS,
          description: "Julius Gold's Movies: order confirmation emails",
        });
      }
      return res.status(200).json({ connected: true, url: webhookUrl });
    }

    if (req.method !== "GET") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const [orders, webhook] = await Promise.all([listPaidOrders(stripe, 100), findWebhook(stripe, webhookUrl)]);
    return res.status(200).json({
      signedInAs: admin.email,
      orders,
      setup: {
        stripeMode: process.env.STRIPE_SECRET_KEY.startsWith("sk_live") ? "live" : "test",
        emailsConfigured: Boolean(process.env.RESEND_API_KEY),
        businessEmail: process.env.BUSINESS_EMAIL || null,
        customSender: Boolean(process.env.EMAIL_FROM),
        webhookConnected: Boolean(webhook),
        webhookUrl,
      },
    });
  } catch (err) {
    console.error("Admin API error:", err.message);
    return res.status(500).json({ error: "Couldn't load data from Stripe." });
  }
}
