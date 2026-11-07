import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Movie from "../ui/Movie";
import { getMovieById, searchMovies } from "../../api";
import { effectivePrice, getPrice, parseRating } from "../../pricing";

const DEFAULT_QUERY = "Avengers"; // shown before the user searches
const MIN_CHARS = 3;
const DEBOUNCE_MS = 600;

const SORT_OPTIONS = [
  { value: "", label: "Best match" },
  { value: "PRICE_LOW", label: "Price: Low to High" },
  { value: "PRICE_HIGH", label: "Price: High to Low" },
  { value: "RATING_HIGH", label: "Rating: High to Low" },
  { value: "RATING_LOW", label: "Rating: Low to High" },
];

// Sort by a numeric field; movies missing that value always go last.
const compareBy = (getValue, direction) => (a, b) => {
  const x = getValue(a);
  const y = getValue(b);
  if (x == null && y == null) return 0;
  if (x == null) return 1;
  if (y == null) return -1;
  return direction * (x - y);
};

const SORTERS = {
  PRICE_LOW: compareBy(effectivePrice, 1),
  PRICE_HIGH: compareBy(effectivePrice, -1),
  RATING_HIGH: compareBy((m) => m.rating, -1),
  RATING_LOW: compareBy((m) => m.rating, 1),
};

const Movies = () => {
  // Search and sort live in the URL (?q=...&sort=...), so they survive
  // going to a movie's page and pressing Back, and can be shared as links.
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "";
  const sort = params.get("sort") || "";

  const [input, setInput] = useState(query);
  const [results, setResults] = useState([]);
  const [ratings, setRatings] = useState({});
  const [status, setStatus] = useState("loading"); // loading | done | error

  const updateParams = useCallback(
    (changes) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
          return next;
        },
        { replace: true }
      ),
    [setParams]
  );

  // Keep the box in sync when the URL changes (e.g. Back button).
  useEffect(() => {
    setInput((current) => (current.trim() === query ? current : query));
  }, [query]);

  // Search as you type, once the user pauses.
  useEffect(() => {
    const term = input.trim();
    if (term === query || (term && term.length < MIN_CHARS)) return;
    const timer = setTimeout(() => updateParams({ q: term }), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input, query, updateParams]);

  // Fetch results whenever the query changes; stale requests are ignored.
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const term = query || DEFAULT_QUERY;
    setStatus("loading");

    Promise.all([
      searchMovies(term, { page: 1, signal }),
      searchMovies(term, { page: 2, signal }).catch(() => []),
    ])
      .then(([page1, page2]) => {
        const unique = [...new Map([...page1, ...page2].map((m) => [m.imdbID, m])).values()];
        setResults(unique);
        setStatus("done");

        // Ratings need one detail request per movie; load them in the background.
        unique.forEach(({ imdbID }) => {
          getMovieById(imdbID, { signal })
            .then((data) => parseRating(data.imdbRating))
            .catch(() => (signal.aborted ? undefined : null))
            .then((rating) => {
              if (!signal.aborted) setRatings((prev) => ({ ...prev, [imdbID]: rating }));
            });
        });
      })
      .catch(() => {
        if (signal.aborted) return;
        setResults([]);
        setStatus("error");
      });

    return () => controller.abort();
  }, [query]);

  const movies = useMemo(() => {
    const priced = results.map((m) => ({
      ...m,
      ...getPrice(m.imdbID),
      rating: ratings[m.imdbID],
    }));
    return SORTERS[sort] ? priced.sort(SORTERS[sort]) : priced;
  }, [results, ratings, sort]);

  function handleSubmit(e) {
    e.preventDefault();
    const term = input.trim();
    if (term) updateParams({ q: term });
  }

  function clearSearch() {
    setInput("");
    updateParams({ q: "" });
  }

  const ratingsLoading = sort.startsWith("RATING") && movies.some((m) => m.rating === undefined);

  return (
    <div className="movies__body">
      <div id="main" className="movies__main">
        <section>
          <div className="search">
            <h2 className="section__title search__title">Find Your Movies Here</h2>
            <form className="search__form" onSubmit={handleSubmit} role="search">
              <FontAwesomeIcon icon="magnifying-glass" className="search__icon" />
              <input
                type="text"
                className="search__input"
                placeholder="Search by movie title..."
                aria-label="Search movies"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoComplete="off"
              />
              {input && (
                <button
                  type="button"
                  className="search__clear"
                  onClick={clearSearch}
                  aria-label="Clear search"
                >
                  <FontAwesomeIcon icon="times" />
                </button>
              )}
              <button type="submit" className="search__submit">
                Search
              </button>
            </form>
            <p className="search__hint">
              Results update as you type ({MIN_CHARS}+ letters)
            </p>
          </div>

          <div className="movies__container">
            <div className="row">
              <div className="movies__header">
                <h2 className="movies__header--title">
                  {query ? `Results for "${query}"` : "Popular Movies"}
                  {status === "done" && movies.length > 0 && (
                    <span className="movies__count">{movies.length} movies</span>
                  )}
                </h2>
                <label className="movies__sort">
                  <span>Sort by</span>
                  <select value={sort} onChange={(e) => updateParams({ sort: e.target.value })}>
                    {SORT_OPTIONS.map((o) => (
                      <option value={o.value} key={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {ratingsLoading && status === "done" && (
                <p className="movies__message movies__message--small">Loading ratings...</p>
              )}
              {status === "error" && (
                <p className="movies__message">Something went wrong. Please try again.</p>
              )}
              {status === "done" && movies.length === 0 && (
                <p className="movies__message">No movies found for "{query}".</p>
              )}

              <div className="movies">
                {status === "loading"
                  ? Array.from({ length: 8 }, (_, i) => (
                      <div className="movie" key={i}>
                        <div className="movie__skeleton" />
                      </div>
                    ))
                  : movies.map((movie) => <Movie movie={movie} key={movie.imdbID} showDetails />)}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Movies;
