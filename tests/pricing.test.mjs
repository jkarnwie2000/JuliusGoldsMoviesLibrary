import { describe, expect, it } from "vitest";
import {
  effectivePrice,
  getPrice,
  MAILING_FEE,
  orderTotals,
  parseRating,
  TAX_RATE,
  toCents,
} from "../src/pricing.mjs";

const IDS = ["tt0848228", "tt0892769", "tt0372784", "tt0468569", "tt1345836", "tt0096895", "tt1877830"];

describe("getPrice", () => {
  it("gives the same movie the same price every time", () => {
    for (const id of IDS) expect(getPrice(id)).toEqual(getPrice(id));
  });

  it("only uses the store's list prices", () => {
    const allowed = [7.99, 9.99, 12.99, 14.99, 17.99, 19.99, 24.99];
    for (const id of IDS) expect(allowed).toContain(getPrice(id).originalPrice);
  });

  it("sale prices are cheaper than the original and end in .99", () => {
    // Scan many IDs so we're sure to hit discounted ones.
    const sales = Array.from({ length: 300 }, (_, i) => getPrice(`tt${1000000 + i}`)).filter((p) => p.salePrice);
    expect(sales.length).toBeGreaterThan(30); // roughly a third are on sale
    for (const { originalPrice, salePrice } of sales) {
      expect(salePrice).toBeLessThan(originalPrice);
      expect(toCents(salePrice) % 100).toBe(99);
    }
  });

  it("matches the price shown during the live test purchase", () => {
    expect(getPrice("tt0848228")).toEqual({ originalPrice: 9.99, salePrice: null }); // The Avengers
    expect(effectivePrice(getPrice("tt0892769"))).toBe(24.99); // How to Train Your Dragon
  });
});

describe("orderTotals", () => {
  it("adds 10% tax on the movies and a flat $4.99 mailing fee", () => {
    const totals = orderTotals([
      { id: "tt0848228", quantity: 1 },
      { id: "tt0892769", quantity: 2 },
    ]);
    expect(totals).toEqual({ subtotalCents: 5997, taxCents: 600, mailingCents: 499, totalCents: 7096 });
    expect(TAX_RATE).toBe(0.1);
    expect(MAILING_FEE).toBe(4.99);
  });

  it("charges nothing for an empty cart (no mailing fee either)", () => {
    expect(orderTotals([])).toEqual({ subtotalCents: 0, taxCents: 0, mailingCents: 0, totalCents: 0 });
  });

  it("works in whole cents, so totals never drift by a fraction of a penny", () => {
    const items = IDS.map((id, i) => ({ id, quantity: i + 1 }));
    const { subtotalCents, taxCents, mailingCents, totalCents } = orderTotals(items);
    for (const n of [subtotalCents, taxCents, mailingCents, totalCents]) expect(Number.isInteger(n)).toBe(true);
    expect(totalCents).toBe(subtotalCents + taxCents + mailingCents);
  });

  it("ignores any price the caller tries to supply", () => {
    const honest = orderTotals([{ id: "tt0848228", quantity: 1 }]);
    const spoofed = orderTotals([{ id: "tt0848228", quantity: 1, salePrice: 0.01, originalPrice: 0.01 }]);
    expect(spoofed).toEqual(honest);
  });
});

describe("parseRating", () => {
  it("reads IMDb ratings and treats missing ones as null", () => {
    expect(parseRating("7.8")).toBe(7.8);
    expect(parseRating("N/A")).toBeNull();
    expect(parseRating(undefined)).toBeNull();
  });
});
