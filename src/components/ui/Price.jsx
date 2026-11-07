const Price = ({ salePrice, originalPrice }) => {
  if (!originalPrice) return null;
  return (
    <div className="movie__price">
      {salePrice ? (
        <>
          <span className="movie__price--normal">${originalPrice.toFixed(2)}</span>
          <span className="movie__price--sale">${salePrice.toFixed(2)}</span>
          <span className="movie__price--badge">
            {Math.round((1 - salePrice / originalPrice) * 100)}% off
          </span>
        </>
      ) : (
        <>${originalPrice.toFixed(2)}</>
      )}
    </div>
  );
};

export default Price;
