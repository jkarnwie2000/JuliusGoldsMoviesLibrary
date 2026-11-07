import axios from "axios";

// Movie data comes through our own server function (api/omdb.mjs), which holds
// the OMDb key and caches answers for everyone. Locally, run `vercel dev` so
// /api routes work; `npm start` alone doesn't serve them.
const BASE_URL = "/api/omdb";

// Session-level cache so revisiting a page doesn't re-hit the API.
const cache = new Map();

// Lets a caller stop waiting without cancelling the shared request,
// so other components awaiting the same cached request aren't affected.
function withSignal(promise, signal) {
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException("Aborted", "AbortError"));
    if (signal.aborted) return abort();
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject);
  });
}

function cachedGet(params, signal) {
  const key = new URLSearchParams(params).toString();
  if (!cache.has(key)) {
    const request = axios
      .get(BASE_URL, { params })
      .then((res) => res.data)
      .catch((err) => {
        cache.delete(key); // don't cache failures
        throw err;
      });
    cache.set(key, request);
  }
  return withSignal(cache.get(key), signal);
}

const hasPoster = (movie) => movie.Poster && movie.Poster !== "N/A";

export async function searchMovies(term, { page = 1, signal } = {}) {
  // Lowercased so "Batman" and "batman" share one cached answer.
  const data = await cachedGet({ s: term.trim().toLowerCase(), page }, signal);
  if (data.Response === "False") return [];
  return (data.Search || []).filter(hasPoster);
}

export async function getMovieById(id, { signal } = {}) {
  const data = await cachedGet({ i: id, plot: "full" }, signal);
  if (data.Response === "False") throw new Error(data.Error || "Movie not found");
  return data;
}
