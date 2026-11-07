import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// Opening a new page (e.g. clicking a movie) starts at the top of that page.
// Back/forward navigation ("POP") is left alone so shoppers return to where they were.
const ScrollToTop = () => {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType !== "POP") window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, navigationType]);

  return null;
};

export default ScrollToTop;
