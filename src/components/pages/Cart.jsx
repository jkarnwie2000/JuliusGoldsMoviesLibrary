import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { orderTotals, TAX_RATE } from "../../pricing.mjs";

const itemPrice = (item) => item.salePrice || item.originalPrice;

const Cart = ({ cart, changeQuantity, removeItem }) => {
  const [params] = useSearchParams();
  const canceled = params.get("canceled") === "1";
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState("");

  const savings = cart.reduce(
    (sum, item) =>
      item.salePrice ? sum + (item.originalPrice - item.salePrice) * item.quantity : sum,
    0
  );
  const purchasable = cart.filter((item) => item.quantity > 0);
  // Same math the checkout server uses, so the cart matches what Stripe charges.
  const totals = orderTotals(purchasable.map(({ id, quantity }) => ({ id, quantity })));
  const money = (cents) => `$${(cents / 100).toFixed(2)}`;

  // Ask our server to create a Stripe Checkout Session, then go to Stripe's
  // secure payment page. Prices are recalculated on the server.
  async function checkout() {
    setCheckingOut(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: purchasable.map((item) => ({ id: item.id, quantity: item.quantity })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || "We couldn't start checkout.");
      window.location.assign(data.url);
    } catch (err) {
      setError(err.message);
      setCheckingOut(false);
    }
  }

  return (
    <div id="movies__body">
      <main id="movies__main">
        <div className="movies__container">
          <div className="row">
            <div className="movies__container--top">
              <h2 className="cart__title">Cart</h2>
            </div>

            {canceled && cart.length > 0 && (
              <p className="cart__notice">
                Checkout was canceled and you haven't been charged. Your cart is saved below.
              </p>
            )}

            <div className="cart">
              <div className="cart__header">
                <span className="cart__movie">Movie</span>
                <span className="cart__quantity">Quantity</span>
                <span className="cart__total">Price</span>
              </div>
              <div className="cart__body">
                {cart.map((movie) => (
                  <div className="cart__item" key={movie.id}>
                    <div className="cart__movie">
                      <img src={movie.Poster} className="cart__movie--img" alt="" />
                      <div className="cart__movie--info">
                        <Link to={`/movies/${movie.id}`} className="cart__movie--title">
                          {movie.Title}
                        </Link>
                        <span className="cart__movie--price">
                          ${itemPrice(movie).toFixed(2)}
                        </span>
                        <button className="cart__movie--remove" onClick={() => removeItem(movie)}>
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="cart__quantity">
                      <input
                        type="number"
                        min={0}
                        max={99}
                        className="cart__input"
                        aria-label={`Quantity of ${movie.Title}`}
                        value={movie.quantity}
                        onChange={(event) => changeQuantity(movie, event.target.value)}
                      />
                    </div>
                    <div className="cart__total">
                      ${(itemPrice(movie) * movie.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
              {cart.length === 0 && (
                <div className="cart__empty">
                  <img src="/assets/empty_cart.svg" alt="" className="cart__empty--img" />
                  <h2>You don't have any movies in your cart!</h2>
                  <Link to="/movies">
                    <button className="btn">Browse Movies</button>
                  </Link>
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="total">
                <div className="total__item">
                  <span>Subtotal</span>
                  <span>{money(totals.subtotalCents)}</span>
                </div>
                {savings > 0 && (
                  <div className="total__item total__savings">
                    <span>You saved</span>
                    <span>${savings.toFixed(2)}</span>
                  </div>
                )}
                <div className="total__item">
                  <span>Tax ({Math.round(TAX_RATE * 100)}%)</span>
                  <span>{money(totals.taxCents)}</span>
                </div>
                <div className="total__item">
                  <span>Mailing fee</span>
                  <span>{money(totals.mailingCents)}</span>
                </div>
                <div className="total__item total__price">
                  <span>Total</span>
                  <span>{money(totals.totalCents)}</span>
                </div>
                <button
                  className="btn btn__checkout"
                  onClick={checkout}
                  disabled={checkingOut || purchasable.length === 0}
                >
                  <FontAwesomeIcon icon="lock" />{" "}
                  {checkingOut ? "Redirecting to secure checkout..." : "Proceed to Checkout"}
                </button>
                {error && <p className="checkout__error">{error}</p>}
                <p className="checkout__secure">Secure payment powered by Stripe</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Cart;
