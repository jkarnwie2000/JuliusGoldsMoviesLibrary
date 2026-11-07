import { useState } from "react";
import Movie from "../ui/Movie";
import { searchMovies } from "../../api";

const Movies = () => {
  const [movies, setMovies] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error

  async function fetchMovies(e) {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setStatus("loading");
    try {
      // Two pages in parallel gives up to 20 results instead of 10.
      const [page1, page2] = await Promise.all([
        searchMovies(searchTerm, { page: 1 }),
        searchMovies(searchTerm, { page: 2 }).catch(() => []),
      ]);
      const unique = new Map([...page1, ...page2].map((m) => [m.imdbID, m]));
      setMovies([...unique.values()]);
      setStatus("done");
    } catch (err) {
      console.error(err);
      setMovies([]);
      setStatus("error");
    }
  }

  return (
    <div className="movies__body">
      <div id="main" className="movies__main">
        <section>
          <div className="search">
            <h2 className="section__title">Find Your Movies Here</h2>
            <form className="search__form" onSubmit={fetchMovies}>
              <input
                type="text"
                placeholder="Search for movies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button type="submit" disabled={status === "loading"}>
                {status === "loading" ? "Searching..." : "Search"}
              </button>
            </form>
          </div>
          <div className="movies__container">
            <div className="row">
              <div className="movies__header">
                <h2 className="section__title movies__header--title">
                  All Movies
                </h2>
              </div>
              {status === "error" && (
                <p className="movies__message">Something went wrong. Please try again.</p>
              )}
              {status === "done" && movies.length === 0 && (
                <p className="movies__message">No movies found for "{searchTerm}".</p>
              )}
              <div className="movies">
                {movies.map((movie) => (
                  <Movie movie={movie} key={movie.imdbID} />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Movies;
