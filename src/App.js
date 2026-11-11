import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Nav from "./components/ui/Nav";
import Footer from "./components/ui/Footer";
import ScrollToTop from "./components/ui/ScrollToTop";
import Home from "./components/pages/Home";
import { CartContext, CartToast } from "./cart";

// Non-home pages are split into separate bundles and loaded on demand.
const Movies = lazy(() => import("./components/pages/Movies"));
const MovieInfo = lazy(() => import("./components/pages/MovieInfo"));
const Cart = lazy(() => import("./components/pages/Cart"));
const CheckoutSuccess = lazy(() => import("./components/pages/CheckoutSuccess"));
const Admin = lazy(() => import("./components/pages/Admin"));

const CART_KEY = "jg-movies-cart";

// The cart is saved in the browser so it survives page reloads and the
// round trip to Stripe's checkout page.
function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function App() {
  const [cart, setCart] = useState(loadCart);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      // Storage unavailable (private mode etc.) — cart still works for this visit.
    }
  }, [cart]);

  const [toast, setToast] = useState(null); // { title, key }

  // Hide the "Added to your cart" confirmation after a few seconds.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const addToCart = useCallback((movie) => {
    setCart((prev) =>
      prev.some((item) => item.id === movie.id)
        ? prev.map((item) =>
            item.id === movie.id ? { ...item, quantity: Math.min(99, item.quantity + 1) } : item
          )
        : [...prev, { ...movie, quantity: 1 }]
    );
    setToast({ title: movie.Title, key: Date.now() });
  }, []);

  // Sets a movie's quantity by ID; 0 removes it from the cart.
  const setQuantity = useCallback((id, quantity) => {
    const qty = Math.max(0, Math.min(99, Math.floor(+quantity) || 0));
    setCart((prev) =>
      qty === 0
        ? prev.filter((item) => item.id !== id)
        : prev.map((item) => (item.id === id ? { ...item, quantity: qty } : item))
    );
  }, []);

  const changeQuantity = useCallback((movie, quantity) => {
    const qty = Math.max(0, Math.min(99, Math.floor(+quantity) || 0));
    setCart((prev) =>
      prev.map((item) => (item.id === movie.id ? { ...item, quantity: qty } : item))
    );
  }, []);

  const removeItem = useCallback((item) => {
    setCart((prev) => prev.filter((movie) => movie.id !== item.id));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const numberOfItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const cartContext = useMemo(() => {
    const quantities = new Map(cart.map((item) => [item.id, item.quantity]));
    return {
      cart,
      addToCart,
      setQuantity,
      quantityOf: (id) => quantities.get(id) || 0,
      toast,
      dismissToast: () => setToast(null),
    };
  }, [cart, addToCart, setQuantity, toast]);

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ScrollToTop />
      <CartContext.Provider value={cartContext}>
      <div className="App">
        <Nav numberOfItems={numberOfItems} />
        <Suspense fallback={<p className="movies__message">Loading...</p>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/movies" element={<Movies />} />
            <Route
              path="/movies/:id"
              element={<MovieInfo />}
            />
            <Route
              path="/cart"
              element={
                <Cart
                  cart={cart}
                  changeQuantity={changeQuantity}
                  removeItem={removeItem}
                />
              }
            />
            <Route
              path="/checkout/success"
              element={<CheckoutSuccess clearCart={clearCart} />}
            />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </Suspense>
        <Footer />
        <CartToast />
      </div>
      </CartContext.Provider>
    </Router>
  );
}

export default App;
