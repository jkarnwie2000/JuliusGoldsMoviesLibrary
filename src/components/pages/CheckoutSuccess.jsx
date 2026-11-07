import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// Stripe sends customers here after payment. We confirm the payment with our
// server before clearing the cart, so visiting this URL directly does nothing.
const CheckoutSuccess = ({ clearCart }) => {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState(sessionId ? "loading" : "missing");

  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    fetch(`/api/checkout-session?session_id=${encodeURIComponent(sessionId)}`, {
      signal: controller.signal,
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error);
        setOrder(data);
        if (data.paymentStatus === "paid" || data.paymentStatus === "no_payment_required") {
          clearCart();
          setStatus("paid");
        } else {
          setStatus("pending");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, [sessionId, clearCart]);

  const amount =
    order?.amountTotal != null
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: (order.currency || "usd").toUpperCase(),
        }).format(order.amountTotal / 100)
      : null;

  return (
    <div id="movies__body">
      <main id="movies__main">
        <div className="row">
          <div className="order">
            {status === "loading" && <p className="movies__message">Confirming your order...</p>}

            {status === "paid" && (
              <>
                <FontAwesomeIcon icon="circle-check" className="order__icon" />
                <h2 className="order__title">Thank you for your order!</h2>
                <p className="order__para">
                  Your payment{amount && <> of <strong>{amount}</strong></>} was successful.
                  {order.email && (
                    <>
                      {" "}A confirmation email is on its way to <strong>{order.email}</strong>.
                    </>
                  )}
                </p>
                <p className="order__para">Your movies are ready to watch. Enjoy the show!</p>
              </>
            )}

            {status === "pending" && (
              <>
                <h2 className="order__title">Your payment is processing</h2>
                <p className="order__para">
                  We'll email you once it's confirmed. Your cart has been kept just in case.
                </p>
              </>
            )}

            {(status === "error" || status === "missing") && (
              <>
                <h2 className="order__title">We couldn't find that order</h2>
                <p className="order__para">
                  If you completed a payment, check your email for a receipt from Stripe.
                </p>
              </>
            )}

            {status !== "loading" && (
              <div className="order__actions">
                <Link to="/movies" className="btn">
                  Keep Browsing
                </Link>
                {status !== "paid" && (
                  <Link to="/cart" className="order__link">
                    Back to cart
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default CheckoutSuccess;
