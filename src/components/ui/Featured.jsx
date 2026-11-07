import { useEffect, useMemo, useState } from "react";
import { searchMovies } from "../../api";
import { useInView, useRatings } from "../../hooks";
import { getPrice } from "../../pricing.mjs";
import Movie from "./Movie";

const MOVIES_PER_ROW = 8;

// Each category is one OMDb search; add or edit entries to change the home page.
const CATEGORIES = [
  { title: "Featured Movies", query: "Dragon", id: "features" },
  { title: "Superheroes", query: "Avengers" },
  { title: "Dark Knights", query: "Batman" },
  { title: "Galaxy Far, Far Away", query: "Star Wars" },
  { title: "Wizarding World", query: "Harry Potter" },
  { title: "Need for Speed", query: "Fast" },
  { title: "Prehistoric Thrills", query: "Jurassic" },
  { title: "Animated Favorites", query: "Toy Story" },
  { title: "Spies & Secret Agents", query: "Mission Impossible" },
];

const SkeletonRow = () => (
  <div className="movies">
    {Array.from({ length: 4 }, (_, i) => (
      <div className="movie" key={i}>
        <div className="movie__skeleton" />
      </div>
    ))}
  </div>
);

// A row only loads its movies and ratings when it scrolls near the viewport,
// so the first screen loads fast and off-screen rows cost no API calls.
const CategoryRow = ({ title, query, id }) => {
  const [ref, inView] = useInView("400px");
  const [results, setResults] = useState(null);

  useEffect(() => {
    if (!inView) return;
    const controller = new AbortController();
    searchMovies(query, { signal: controller.signal })
      .then((movies) => setResults(movies.slice(0, MOVIES_PER_ROW)))
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error(`Failed to load "${query}"`, err);
        setResults([]);
      });
    return () => controller.abort();
  }, [inView, query]);

  const ids = useMemo(() => (results || []).map((m) => m.imdbID), [results]);
  const ratings = useRatings(ids);

  const movies = useMemo(
    () =>
      (results || []).map((m) => ({
        ...m,
        ...getPrice(m.imdbID),
        rating: ratings[m.imdbID],
      })),
    [results, ratings]
  );

  if (results && results.length === 0) return null;

  return (
    <section id={id} className="movie__category" ref={ref}>
      <div className="container">
        <div className="row">
          <h2 className="section__title">{title}</h2>
          {results ? (
            <div className="movies">
              {movies.map((movie) => (
                <Movie movie={movie} key={movie.imdbID} showDetails />
              ))}
            </div>
          ) : (
            <SkeletonRow />
          )}
        </div>
      </div>
    </section>
  );
};

const Featured = () => (
  <>
    {CATEGORIES.map((category) => (
      <CategoryRow {...category} key={category.query} />
    ))}
  </>
);

export default Featured;
