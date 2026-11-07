import { useEffect, useState } from "react";
import { searchMovies } from "../../api";
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

const Featured = () => {
  const [rows, setRows] = useState({});

  useEffect(() => {
    const controller = new AbortController();

    // Fetch all categories in parallel; each row renders as soon as it arrives.
    CATEGORIES.forEach(({ query }) => {
      searchMovies(query, { signal: controller.signal })
        .then((movies) => setRows((prev) => ({ ...prev, [query]: movies })))
        .catch((err) => {
          if (!controller.signal.aborted) {
            setRows((prev) => ({ ...prev, [query]: [] }));
            console.error(`Failed to load "${query}"`, err);
          }
        });
    });

    return () => controller.abort();
  }, []);

  return (
    <>
      {CATEGORIES.map(({ title, query, id }) => {
        const movies = rows[query];
        if (movies && movies.length === 0) return null;
        return (
          <section id={id} className="movie__category" key={query}>
            <div className="container">
              <div className="row">
                <h2 className="section__title">{title}</h2>
                {movies ? (
                  <div className="movies">
                    {movies.slice(0, MOVIES_PER_ROW).map((movie) => (
                      <Movie movie={movie} key={movie.imdbID} />
                    ))}
                  </div>
                ) : (
                  <SkeletonRow />
                )}
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
};

export default Featured;
