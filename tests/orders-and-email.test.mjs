import { afterEach, describe, expect, it, vi } from "vitest";
import { businessEmail, buyerEmail, sendOrderEmails } from "../api/_lib/email.mjs";
import { formatMoney, toOrder } from "../api/_lib/orders.mjs";
import { jsonResponse } from "./helpers.mjs";

// A Checkout Session shaped like Stripe's real API response.
const session = (overrides = {}) => ({
  id: "cs_test_a1B2c3D4e5F6g7H8",
  created: 1762480000,
  livemode: false,
  payment_status: "paid",
  amount_total: 7096,
  currency: "usd",
  customer_details: { email: "buyer@example.com", name: "Ada <script>Lovelace" },
  collected_information: {
    shipping_details: {
      name: "Ada Lovelace",
      address: { line1: "1 Main St", city: "Austin", state: "TX", postal_code: "78701", country: "US" },
    },
  },
  shipping_cost: { amount_total: 499 },
  metadata: { subtotal_cents: "5997", tax_cents: "600", mailing_cents: "499" },
  line_items: {
    data: [
      { description: "The Avengers (2012)", quantity: 1, amount_total: 999 },
      { description: "How to Train Your Dragon (2010)", quantity: 2, amount_total: 4998 },
      { description: "Sales tax (10%)", quantity: 1, amount_total: 600 },
    ],
  },
  ...overrides,
});

describe("toOrder", () => {
  it("separates movies from the tax line and reads all totals", () => {
    const order = toOrder(session());
    expect(order.items).toEqual([
      { name: "The Avengers (2012)", quantity: 1, amountCents: 999 },
      { name: "How to Train Your Dragon (2010)", quantity: 2, amountCents: 4998 },
    ]);
    expect(order).toMatchObject({ subtotalCents: 5997, taxCents: 600, mailingCents: 499, totalCents: 7096 });
    expect(order.created).toBe(1762480000 * 1000);
  });

  it("reads the mailing address from either Stripe API format", () => {
    const newer = toOrder(session());
    const older = toOrder(
      session({ collected_information: undefined, shipping_details: session().collected_information.shipping_details })
    );
    expect(newer.shipping.lines).toEqual(["1 Main St", "Austin, TX, 78701", "US"]);
    expect(older.shipping).toEqual(newer.shipping);
  });

  it("formats money", () => {
    expect(formatMoney(7096)).toBe("$70.96");
  });
});

describe("order emails", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("buyer receipt lists the items, totals and address", () => {
    const { subject, html } = buyerEmail(toOrder(session()));
    expect(subject).toBe("Your order is confirmed (#E5F6G7H8)");
    for (const text of ["The Avengers (2012)", "$59.97", "$6.00", "$4.99", "$70.96", "Austin, TX, 78701"]) {
      expect(html).toContain(text);
    }
  });

  it("escapes customer-supplied text so it can't inject HTML", () => {
    const { html } = businessEmail(toOrder(session()));
    expect(html).toContain("Ada &lt;script&gt;Lovelace");
    expect(html).not.toContain("<script>");
  });

  it("marks test-mode orders in the business copy", () => {
    expect(businessEmail(toOrder(session())).html).toContain("Test-mode order");
    expect(businessEmail(toOrder(session({ livemode: true }))).html).not.toContain("Test-mode order");
  });

  it("sends to the buyer and the business with duplicate-proof keys", async () => {
    vi.stubEnv("RESEND_API_KEY", ' "re_test" '); // stray quotes/spaces are tolerated
    vi.stubEnv("BUSINESS_EMAIL", "owner@example.com");
    const fetchMock = vi.fn(async () => jsonResponse({ id: "email_1" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendOrderEmails(toOrder(session()));

    expect(result).toEqual({ attempted: 2, sent: 2, failures: [] });
    const calls = fetchMock.mock.calls.map(([, opts]) => ({ to: JSON.parse(opts.body).to[0], ...opts.headers }));
    expect(calls.map((c) => c.to)).toEqual(["buyer@example.com", "owner@example.com"]);
    expect(calls.map((c) => c["Idempotency-Key"])).toEqual([
      "order-cs_test_a1B2c3D4e5F6g7H8-buyer-auto",
      "order-cs_test_a1B2c3D4e5F6g7H8-business-auto",
    ]);
    expect(calls[0].Authorization).toBe("Bearer re_test");
  });

  it("still sends the business copy when the buyer's email is rejected", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("BUSINESS_EMAIL", "owner@example.com");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", async (_url, opts) =>
      JSON.parse(opts.body).to[0] === "buyer@example.com"
        ? jsonResponse({ message: "domain not verified" }, 403)
        : jsonResponse({ id: "ok" })
    );

    const result = await sendOrderEmails(toOrder(session()), { tag: "resend-1" });

    expect(result.sent).toBe(1);
    expect(result.failures).toEqual([{ to: "buyer", error: expect.stringContaining("403") }]);
  });
});
