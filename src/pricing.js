// OMDb has no prices, so each movie gets a stable price derived from its IMDb ID.
// The same movie always shows the same price on every page and in the cart.

const PRICES = [7.99, 9.99, 12.99, 14.99, 17.99, 19.99, 24.99];
const DISCOUNTS = [0.2, 0.25, 0.3, 0.4];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getPrice(imdbID) {
  const h = hash(imdbID);
  const originalPrice = PRICES[h % PRICES.length];
  const onSale = (h >>> 8) % 3 === 0; // roughly 1 in 3 movies is discounted
  // Sale prices end in .99, e.g. 19.99 at 30% off -> 13.99
  const discount = DISCOUNTS[(h >>> 12) % DISCOUNTS.length];
  const salePrice = onSale ? Math.floor(originalPrice * (1 - discount)) + 0.99 : null;
  return { originalPrice, salePrice };
}

export const effectivePrice = (movie) => movie.salePrice || movie.originalPrice;

// IMDb rating ("7.8" out of 10) -> number, or null when unavailable.
export function parseRating(imdbRating) {
  const n = parseFloat(imdbRating);
  return Number.isFinite(n) ? n : null;
}
