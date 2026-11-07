import { createContext, useContext } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { getPrice } from "./pricing.mjs";

// Shared cart state so any movie card can add to the cart without leaving the page.
export const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

// The cart item for a movie (works with search results and full movie details).
export const toCartItem = (movie) => ({
  id: movie.imdbID,
  Title: movie.Title,
  Year: movie.Year,
  Poster: movie.Poster,
  ...getPrice(movie.imdbID),
});

// "Add to cart", which becomes a  − qty +  stepper once the movie is in the cart.
export const AddToCart = ({ movie, size = "small" }) => {
  const { addToCart, setQuantity, quantityOf } = useCart();
  const qty = quantityOf(movie.imdbID);

  if (qty === 0) {
    return (
      <button
        type="button"
        className={`add-to-cart add-to-cart--${size}`}
        onClick={() => addToCart(toCartItem(movie))}
      >
        <FontAwesomeIcon icon="shopping-cart" /> Add to Cart
      </button>
    );
  }

  return (
    <div className={`qty-stepper qty-stepper--${size}`} role="group" aria-label={`${movie.Title} quantity in cart`}>
      <button
        type="button"
        onClick={() => setQuantity(movie.imdbID, qty - 1)}
        aria-label={qty === 1 ? `Remove ${movie.Title} from cart` : `One fewer ${movie.Title}`}
      >
        −
      </button>
      <span aria-live="polite">
        <FontAwesomeIcon icon="shopping-cart" /> {qty} in cart
      </span>
      <button
        type="button"
        onClick={() => addToCart(toCartItem(movie))}
        aria-label={`Add another ${movie.Title}`}
        disabled={qty >= 99}
      >
        +
      </button>
    </div>
  );
};

// Brief confirmation that appears after adding, with a shortcut to the cart.
export const CartToast = () => {
  const { toast, dismissToast } = useCart();
  if (!toast) return null;
  return (
    <div className="cart-toast" role="status" key={toast.key}>
      <FontAwesomeIcon icon="circle-check" className="cart-toast__icon" />
      <span className="cart-toast__text">
        Added <strong>{toast.title}</strong> to your cart
      </span>
      <Link to="/cart" className="cart-toast__link" onClick={dismissToast}>
        View cart
      </Link>
      <button type="button" className="cart-toast__close" onClick={dismissToast} aria-label="Dismiss">
        <FontAwesomeIcon icon="times" />
      </button>
    </div>
  );
};
