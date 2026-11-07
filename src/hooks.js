import { useEffect, useRef, useState } from "react";
import { getMovieById } from "./api";
import { parseRating } from "./pricing.mjs";

// True once the element has scrolled within `rootMargin` of the viewport (stays true).
export function useInView(rootMargin = "300px") {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (inView || !el) return;
    if (!("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return [ref, inView];
}

// IMDb ratings keyed by imdbID: undefined = loading, null = unavailable.
// Each movie's details are cached by the API layer, so ratings load once per visit.
export function useRatings(ids) {
  const [ratings, setRatings] = useState({});
  const key = ids.join(",");

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const { signal } = controller;

    key.split(",").forEach((id) => {
      getMovieById(id, { signal })
        .then((data) => parseRating(data.imdbRating))
        .catch(() => null)
        .then((rating) => {
          if (!signal.aborted) setRatings((prev) => ({ ...prev, [id]: rating }));
        });
    });

    return () => controller.abort();
  }, [key]);

  return ratings;
}
