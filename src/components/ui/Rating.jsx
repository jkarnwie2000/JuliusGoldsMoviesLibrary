import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// `rating` is an IMDb score out of 10; shown as 0–5 stars in half-star steps.
const Rating = ({ rating }) => {
  if (rating === undefined) {
    return <div className="movie__ratings movie__ratings--loading" aria-hidden="true" />;
  }
  if (rating === null) {
    return <div className="movie__ratings movie__ratings--none">No rating yet</div>;
  }
  const stars = Math.round(rating) / 2; // e.g. 7.8 -> 4 stars, 7.2 -> 3.5
  const full = Math.floor(stars);
  return (
    <div className="movie__ratings" title={`IMDb ${rating}/10`}>
      {Array.from({ length: full }, (_, i) => (
        <FontAwesomeIcon icon="star" key={i} />
      ))}
      {stars !== full && <FontAwesomeIcon icon="star-half-alt" />}
      <span className="movie__ratings--score">{rating.toFixed(1)}</span>
    </div>
  );
};

export default Rating;
