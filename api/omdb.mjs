// GET /api/omdb  — proxy to the OMDb movie database using our own key (OMDB_API_KEY).
//   ?s=<title>&page=<1-10>   search movies
//   ?i=<imdbID>[&plot=full]  one movie's details
//
// Responses are cached on Vercel's CDN, so a search or movie fetched for one
// visitor is reused for everyone for a day. That keeps us far below OMDb's
// daily request limit, and the key never reaches visitors' browsers.
const OMDB_URL = "https://www.omdbapi.com/";
const IMDB_ID = /^tt\d{7,10}$/;
const CACHE_OK = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

export const omdbKey = () => String(process.env.OMDB_API_KEY || "").trim().replace(/^["']|["']$/g, "");

// Fetch from OMDb on the server (also used by checkout to look up titles).
export async function fetchOmdb(params) {
  const url = new URL(OMDB_URL);
  url.searchParams.set("apikey", omdbKey());
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  const data = await res.json().catch(() => ({ Response: "False", Error: `OMDb HTTP ${res.status}` }));
  return { status: res.status, data };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ Response: "False", Error: "Method not allowed" });
  }
  if (!omdbKey()) {
    return res.status(503).json({ Response: "False", Error: "Movie database is not configured." });
  }

  // Only forward the few parameters the site uses.
  const q = req.query || {};
  const params = {};
  if (typeof q.i === "string" && IMDB_ID.test(q.i)) {
    params.i = q.i;
    if (q.plot === "full") params.plot = "full";
  } else if (typeof q.s === "string" && q.s.trim() && q.s.length <= 100) {
    params.s = q.s.trim();
    params.type = "movie";
    const page = Number(q.page) || 1;
    params.page = String(Math.min(10, Math.max(1, Math.floor(page))));
  } else {
    return res.status(400).json({ Response: "False", Error: "Invalid request." });
  }

  try {
    const { status, data } = await fetchOmdb(params);
    // Cache real answers (including "Movie not found!"), never errors like a used-up limit.
    const answered = status === 200 && (data.Response === "True" || /not found/i.test(data.Error || ""));
    if (!answered) {
      console.error("OMDb error:", status, data.Error);
      res.setHeader("Cache-Control", "no-store");
      return res.status(502).json({ Response: "False", Error: "The movie database is unavailable right now." });
    }
    res.setHeader("Cache-Control", CACHE_OK);
    return res.status(200).json(data);
  } catch (err) {
    console.error("OMDb fetch failed:", err.message);
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ Response: "False", Error: "The movie database is unavailable right now." });
  }
}
