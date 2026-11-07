import { memo, useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Price from "./Price";
import Rating from "./Rating";

// Price and rating are shown only when the movie object carries them (Movies page).
const Movie = ({ movie, showDetails = false }) => {
  const to = `/movies/${movie.imdbID}`;
  const [posterFailed, setPosterFailed] = useState(false);
  return (
    <div className="movie">
      <Link to={to}>
        <figure className="movie__img--wrapper">
          {posterFailed ? (
            <div className="movie__img--fallback">
              <FontAwesomeIcon icon="compact-disc" />
              <span>{movie.Title}</span>
            </div>
          ) : (
            <img
              src={movie.Poster}
              alt={`${movie.Title} poster`}
              className="movie__img"
              loading="lazy"
              decoding="async"
              onError={() => setPosterFailed(true)}
            />
          )}
        </figure>
      </Link>
      <div className="movie__title">
        <Link to={to} className="movie__title--link">
          {movie.Title}
          {movie.Year && <span className="movie__year"> ({movie.Year})</span>}
        </Link>
      </div>
      {showDetails && (
        <>
          <Rating rating={movie.rating} />
          <Price originalPrice={movie.originalPrice} salePrice={movie.salePrice} />
        </>
      )}
    </div>
  );
};

export default memo(Movie);
