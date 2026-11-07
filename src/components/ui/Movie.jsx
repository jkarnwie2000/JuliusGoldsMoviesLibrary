import { memo } from "react";
import { Link } from "react-router-dom";

const Movie = ({ movie }) => {
  const to = `/movies/${movie.imdbID}`;
  return (
    <div className="movie">
      <Link to={to}>
        <figure className="movie__img--wrapper">
          <img
            src={movie.Poster}
            alt={`${movie.Title} poster`}
            className="movie__img"
            loading="lazy"
            decoding="async"
          />
        </figure>
      </Link>
      <div className="movie__title">
        <Link to={to} className="movie__title--link">
          {movie.Title}
          {movie.Year && <span className="movie__year"> ({movie.Year})</span>}
        </Link>
      </div>
    </div>
  );
};

export default memo(Movie);
