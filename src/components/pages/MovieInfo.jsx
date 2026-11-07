import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { getMovieById } from "../../api";
import { AddToCart, useCart } from "../../cart";
import { getPrice, parseRating } from "../../pricing.mjs";
import Price from "../ui/Price";
import Rating from "../ui/Rating";

const MovieInfo = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { quantityOf } = useCart();
  const inCart = quantityOf(id) > 0;
  const [movie, setMovie] = useState(null);
  const [error, setError] = useState(null);

  // Go back to where the shopper came from (keeps their search), or to the Movies page.
  const continueShopping = () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate("/movies");
  };

  useEffect(() => {
    const controller = new AbortController();
    setMovie(null);
    setError(null);
    getMovieById(id, { signal: controller.signal })
      .then(setMovie)
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => controller.abort();
  }, [id]);

  return (
    <div id="movies__body">
      <main id="movies__main">
        <div className="movies__container">
          <div className="row">
            <div className="movie__selected--top">
              <Link to="/movies" aria-label="Back to movies">
                <FontAwesomeIcon icon="arrow-left" />
              </Link>
              <Link to="/movies">
                <h2 className="movie__selected--title--top">Movies</h2>
              </Link>
            </div>
            {error && <p className="movies__message">{error}</p>}
            {!error && !movie && <p className="movies__message">Loading...</p>}
            {movie && (
              <div className="movie__selected">
                <figure className="movie__selected--figure">
                  {movie.Poster && movie.Poster !== "N/A" && (
                    <img
                      src={movie.Poster}
                      alt={`${movie.Title} poster`}
                      className="movie__selected--img"
                    />
                  )}
                </figure>
                <div className="movie__selected--description">
                  <h2 className="movie__selected--title">{movie.Title}</h2>
                  <p className="movie__selected--meta">
                    {[movie.Year, movie.Rated, movie.Runtime, movie.Genre]
                      .filter((v) => v && v !== "N/A")
                      .join(" • ")}
                  </p>
                  <Rating rating={parseRating(movie.imdbRating)} />
                  <Price {...getPrice(movie.imdbID)} />
                  <div className="movie__selected--actions">
                    <AddToCart movie={movie} size="large" />
                    {inCart && (
                      <div className="movie__selected--next">
                        <button type="button" className="movie__next-btn" onClick={continueShopping}>
                          <FontAwesomeIcon icon="arrow-left" /> Continue shopping
                        </button>
                        <Link to="/cart" className="movie__next-btn movie__next-btn--cart">
                          View cart &amp; checkout
                        </Link>
                      </div>
                    )}
                  </div>
                  <div className="movie__summary">
                    <h3 className="movie__summary--title">Summary</h3>
                    <p className="movie__summary--para">{movie.Plot}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default MovieInfo;
