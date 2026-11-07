// POST /api/checkout  — creates a Stripe Checkout Session for the cart.
// Body: { items: [{ id: "tt0848228", quantity: 2 }, ...] }
// Prices are recalculated here from the shared pricing module, so the browser
// can never change what a customer is charged.
import Stripe from "stripe";
import { getPrice } from "../src/pricing.mjs";

const OMDB_KEY = "25cd594";
const IMDB_ID = /^tt\d{7,10}$/;
const MAX_LINE_ITEMS = 50;
const MAX_QUANTITY = 99;

async function lookupMovie(id) {
  try {
    const res = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_KEY}&i=${id}`);
    const data = await res.json();
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
    const { originalPrice, salePrice } = getPrice(id);
    const movie = movies[i];
    const poster = movie?.Poster?.startsWith("https://") ? [movie.Poster] : undefined;
    return {
      quantity,
      price_data: {
        currency: "usd",
        unit_amount: Math.round((salePrice || originalPrice) * 100),
        product_data: {
          name: movie ? `${movie.Title} (${movie.Year})` : `Movie ${id}`,
          ...(poster && { images: poster }),
          metadata: { imdbID: id },
        },
      },
    };
  });

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const origin = siteOrigin(req);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart?canceled=1`,
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err.message);
    return res.status(500).json({ error: "We couldn't start checkout. Please try again." });
  }
}
