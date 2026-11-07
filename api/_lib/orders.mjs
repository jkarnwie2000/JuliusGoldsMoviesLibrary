// Turns a Stripe Checkout Session (with line_items expanded) into a plain order
// object used by the confirmation emails and the admin dashboard.
// Files under api/_lib are helpers, not public endpoints.

const isTaxLine = (item) => /^sales tax/i.test(item.description || "");

function shippingOf(session) {
  // Newer Stripe API versions moved shipping details under collected_information.
  const s = session.collected_information?.shipping_details || session.shipping_details;
  if (!s) return null;
  const a = s.address || {};
  return {
    name: s.name || "",
    lines: [a.line1, a.line2, [a.city, a.state, a.postal_code].filter(Boolean).join(", "), a.country].filter(Boolean),
    city: a.city || "",
    state: a.state || "",
    country: a.country || "",
  };
}

export function toOrder(session) {
  const lineItems = session.line_items?.data || [];
  const taxLine = lineItems.find(isTaxLine);
  const items = lineItems
    .filter((item) => !isTaxLine(item))
    .map((item) => ({
      name: item.description,
      quantity: item.quantity,
      amountCents: item.amount_total,
    }));
  const meta = session.metadata || {};
  const subtotalCents = meta.subtotal_cents ? +meta.subtotal_cents : items.reduce((s, i) => s + i.amountCents, 0);
  return {
    id: session.id,
    created: session.created * 1000,
    livemode: session.livemode,
    paymentStatus: session.payment_status,
    email: session.customer_details?.email || null,
    customerName: session.customer_details?.name || shippingOf(session)?.name || "",
    shipping: shippingOf(session),
    items,
    subtotalCents,
    taxCents: taxLine ? taxLine.amount_total : +(meta.tax_cents || 0),
    mailingCents: session.shipping_cost?.amount_total ?? +(meta.mailing_cents || 0),
    totalCents: session.amount_total,
    currency: session.currency || "usd",
  };
}

export async function getOrder(stripe, sessionId) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });
  return toOrder(session);
}

// Most recent paid orders, newest first.
export async function listPaidOrders(stripe, limit = 100) {
  let sessions;
  try {
    sessions = await stripe.checkout.sessions.list({ status: "complete", limit, expand: ["data.line_items"] });
  } catch {
    // Fallback if list expansion isn't available: fetch line items per session.
    sessions = await stripe.checkout.sessions.list({ status: "complete", limit });
    await Promise.all(
      sessions.data.map(async (s) => {
        s.line_items = await stripe.checkout.sessions.listLineItems(s.id, { limit: 100 });
      })
    );
  }
  return sessions.data
    .filter((s) => s.payment_status === "paid" || s.payment_status === "no_payment_required")
    .map(toOrder);
}

export const formatMoney = (cents, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
