import { beforeEach, describe, expect, it, vi } from "vitest";
import { callHandler, jsonResponse } from "./helpers.mjs";

// Stand-in for the Stripe SDK that records what our code asks Stripe to do.
const stripeCalls = vi.hoisted(() => ({ created: [], webhooks: [], fail: false }));
vi.mock("stripe", () => ({
  default: class FakeStripe {
    checkout = {
      sessions: {
        create: async (params) => {
          if (stripeCalls.fail) throw new Error("Invalid API Key provided");
          stripeCalls.created.push(params);
          return { url: "https://checkout.stripe.com/c/pay/cs_test_fake" };
        },
      },
    };
    events = { retrieve: async () => { throw new Error("No such event"); } };
    webhookEndpoints = {
      list: async () => ({ data: stripeCalls.webhooks }),
      create: async (params) => { stripeCalls.webhooks.push({ ...params, status: "enabled" }); return params; },
    };
  },
}));

const { default: omdb } = await import("../api/omdb.mjs");
const { default: checkout } = await import("../api/checkout.mjs");
const { default: webhook } = await import("../api/stripe-webhook.mjs");
const { default: admin } = await import("../api/admin.mjs");

beforeEach(() => {
  stripeCalls.created = [];
  stripeCalls.webhooks = [];
  stripeCalls.fail = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("OMDB_API_KEY", "omdb-test-key");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
  vi.stubEnv("SITE_URL", "https://shop.example.com/");
});

describe("GET /api/omdb (movie data proxy)", () => {
  it("forwards only allowed parameters, adds our key, and caches answers for a day", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ Response: "True", Search: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await callHandler(omdb, { query: { s: " batman ", page: "99", evil: "1" } });

    const sent = new URL(fetchMock.mock.calls[0][0]).searchParams;
    expect(Object.fromEntries(sent)).toEqual({ apikey: "omdb-test-key", s: "batman", type: "movie", page: "10" });
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toContain("s-maxage=86400");
  });

  it("looks up a single movie by IMDb ID", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ Response: "True", Title: "The Avengers" }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await callHandler(omdb, { query: { i: "tt0848228", plot: "full" } });
    expect(res.body.Title).toBe("The Avengers");
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("plot")).toBe("full");
  });

  it("caches 'not found' answers too", async () => {
    vi.stubGlobal("fetch", async () => jsonResponse({ Response: "False", Error: "Movie not found!" }));
    const res = await callHandler(omdb, { query: { s: "zzzzzz" } });
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toContain("s-maxage");
  });

  it("never caches errors such as a used-up daily limit", async () => {
    vi.stubGlobal("fetch", async () => jsonResponse({ Response: "False", Error: "Request limit reached!" }, 401));
    const res = await callHandler(omdb, { query: { s: "batman" } });
    expect(res.status).toBe(502);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it.each([
    ["no parameters", {}],
    ["a bad IMDb ID", { i: "../etc/passwd" }],
    ["an overly long search", { s: "a".repeat(101) }],
  ])("rejects %s", async (_label, query) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await callHandler(omdb, { query })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports when the key isn't configured", async () => {
    vi.stubEnv("OMDB_API_KEY", "");
    expect((await callHandler(omdb, { query: { s: "batman" } })).status).toBe(503);
  });
});

describe("POST /api/checkout", () => {
  const post = (body) => callHandler(checkout, { method: "POST", body, headers: { host: "shop.example.com" } });
  const movieLookup = async (url) => {
    const id = new URL(url).searchParams.get("i");
    return jsonResponse({ Response: "True", Title: `Movie ${id}`, Year: "2012", Poster: "https://img.example.com/p.jpg" });
  };

  it("builds a Stripe session with server-side prices, 10% tax and the mailing fee", async () => {
    vi.stubGlobal("fetch", movieLookup);
    const res = await post({ items: [{ id: "tt0848228", quantity: 1 }, { id: "tt0892769", quantity: 2 }] });

    expect(res.body.url).toContain("checkout.stripe.com");
    const params = stripeCalls.created[0];
    const amounts = params.line_items.map((li) => [li.price_data.product_data.name, li.price_data.unit_amount, li.quantity]);
    expect(amounts).toEqual([
      ["Movie tt0848228 (2012)", 999, 1],
      ["Movie tt0892769 (2012)", 2499, 2],
      ["Sales tax (10%)", 600, 1],
    ]);
    expect(params.shipping_options[0].shipping_rate_data.fixed_amount).toEqual({ amount: 499, currency: "usd" });
    expect(params.shipping_address_collection.allowed_countries).toEqual(["US", "CA"]);
    expect(params.success_url).toBe("https://shop.example.com/checkout/success?session_id={CHECKOUT_SESSION_ID}");
  });

  it("ignores prices sent by the browser and merges duplicate movies", async () => {
    vi.stubGlobal("fetch", movieLookup);
    await post({ items: [
      { id: "tt0848228", quantity: 1, salePrice: 0.01 },
      { id: "tt0848228", quantity: 2 },
    ] });
    const [movie] = stripeCalls.created[0].line_items;
    expect(movie.price_data.unit_amount).toBe(999);
    expect(movie.quantity).toBe(3);
  });

  it("still works if the movie database is down (uses a generic name)", async () => {
    vi.stubGlobal("fetch", async () => { throw new Error("offline"); });
    await post({ items: [{ id: "tt0848228", quantity: 1 }] });
    expect(stripeCalls.created[0].line_items[0].price_data.product_data.name).toBe("Movie tt0848228");
  });

  it.each([
    ["an empty cart", { items: [] }, /empty/],
    ["a malformed movie ID", { items: [{ id: "<script>", quantity: 1 }] }, /invalid/],
    ["a zero quantity", { items: [{ id: "tt0848228", quantity: 0 }] }, /invalid/],
    ["a fractional quantity", { items: [{ id: "tt0848228", quantity: 1.5 }] }, /invalid/],
  ])("rejects %s", async (_label, body, message) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
    expect(stripeCalls.created).toHaveLength(0);
  });

  it("rejects GET requests and explains a missing Stripe key", async () => {
    expect((await callHandler(checkout, { method: "GET" })).status).toBe(405);
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect((await post({ items: [{ id: "tt0848228", quantity: 1 }] })).status).toBe(500);
  });

  it("shows a friendly error if Stripe refuses", async () => {
    vi.stubGlobal("fetch", movieLookup);
    stripeCalls.fail = true;
    const res = await post({ items: [{ id: "tt0848228", quantity: 1 }] });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/couldn't start checkout/);
  });
});

describe("POST /api/stripe-webhook", () => {
  it("rejects malformed and forged events (it re-checks every event with Stripe)", async () => {
    expect((await callHandler(webhook, { method: "GET" })).status).toBe(405);
    expect((await callHandler(webhook, { method: "POST", body: { id: "nope" } })).status).toBe(400);
    expect((await callHandler(webhook, { method: "POST", body: { id: "evt_forged123" } })).status).toBe(400);
  });
});

describe("/api/admin", () => {
  it("refuses requests without a valid sign-in", async () => {
    vi.stubEnv("SESSION_SECRET", "test-secret");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
    const none = await callHandler(admin, { headers: {} });
    const forged = await callHandler(admin, { headers: { authorization: "Bearer eyJlIjoieCJ9.fake" } });
    expect(none.status).toBe(401);
    expect(forged.status).toBe(401);
  });
});
