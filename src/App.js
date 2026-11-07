import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Nav from "./components/ui/Nav";
import Footer from "./components/ui/Footer";
import Home from "./components/pages/Home";

// Non-home pages are split into separate bundles and loaded on demand.
const Movies = lazy(() => import("./components/pages/Movies"));
const MovieInfo = lazy(() => import("./components/pages/MovieInfo"));
const Cart = lazy(() => import("./components/pages/Cart"));

function App() {
  const [cart, setCart] = useState([]);

  const addToCart = useCallback((movie) => {
    setCart((prev) => [...prev, { ...movie, quantity: 1 }]);
  }, []);

  const changeQuantity = useCallback((movie, quantity) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === movie.id ? { ...item, quantity: +quantity } : item
      )
    );
  }, []);

  const removeItem = useCallback((item) => {
    setCart((prev) => prev.filter((movie) => movie.id !== item.id));
  }, []);

  const numberOfItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  return (
    <Router>
      <div className="App">
        <Nav numberOfItems={numberOfItems} />
        <Suspense fallback={<p className="movies__message">Loading...</p>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/movies" element={<Movies />} />
            <Route
              path="/movies/:id"
              element={<MovieInfo addToCart={addToCart} cart={cart} />}
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
          </Routes>
        </Suspense>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
