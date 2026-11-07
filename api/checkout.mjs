// POST /api/checkout  — creates a Stripe Checkout Session for the cart.
// Body: { items: [{ id: "tt0848228", quantity: 2 }, ...] }
// Prices are recalculated here from the shared pricing module, so the browser
// can never change what a customer is charged.
import Stripe from "stripe";
import { effectivePrice, getPrice, orderTotals, TAX_RATE, toCents } from "../src/pricing.mjs";
import { fetchOmdb } from "./omdb.mjs";

const IMDB_ID = /^tt\d{7,10}$/;
const MAX_LINE_ITEMS = 50;
const MAX_QUANTITY = 99;
// Countries we mail to; add ISO country codes here to ship further.
const SHIPPING_COUNTRIES = ["US", "CA"];

async function lookupMovie(id) {
  try {
    const { data } = await fetchOmdb({ i: id });
    return data.Response === "True" ? data : null;
  } catch {
    return null;
  }
}

function siteOrigin(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${req.headers.host}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: "Payments are not set up yet. Please try again later." });
  }

  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) {
    return res.status(400).json({ error: "Your cart is empty." });
  }

  // Validate and merge duplicate movies.
  const cart = new Map();
  for (const item of items) {
    const id = item?.id;
    const quantity = Number(item?.quantity);
    if (typeof id !== "string" || !IMDB_ID.test(id) || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: "Your cart contains an invalid item." });
    }
    cart.set(id, Math.min(MAX_QUANTITY, (cart.get(id) || 0) + quantity));
  }
  if (cart.size > MAX_LINE_ITEMS) {
    return res.status(400).json({ error: `Please check out ${MAX_LINE_ITEMS} movies or fewer at a time.` });
  }

  const entries = [...cart];
  const movies = await Promise.all(entries.map(([id]) => lookupMovie(id)));

  const line_items = entries.map(([id, quantity], i) => {
    const movie = movies[i];
    const poster = movie?.Poster?.startsWith("https://") ? [movie.Poster] : undefined;
    return {
      quantity,
      price_data: {
        currency: "usd",
        unit_amount: toCents(effectivePrice(getPrice(id))),
        product_data: {
          name: movie ? `${movie.Title} (${movie.Year})` : `Movie ${id}`,
          ...(poster && { images: poster }),
          metadata: { imdbID: id },
        },
      },
    };
  });

  // Tax and mailing come from the same shared math the cart page shows.
  const totals = orderTotals(entries.map(([id, quantity]) => ({ id, quantity })));
  line_items.push({
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: totals.taxCents,
      product_data: { name: `Sales tax (${Math.round(TAX_RATE * 100)}%)` },
    },
  });

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const origin = siteOrigin(req);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      shipping_address_collection: { allowed_countries: SHIPPING_COUNTRIES },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: "Mailing fee",
            fixed_amount: { amount: totals.mailingCents, currency: "usd" },
          },
        },
      ],
      metadata: {
        subtotal_cents: String(totals.subtotalCents),
        tax_cents: String(totals.taxCents),
        mailing_cents: String(totals.mailingCents),
      },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart?canceled=1`,
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err.message);
    return res.status(500).json({ error: "We couldn't start checkout. Please try again." });
  }
}
