import { Link } from "react-router-dom";

// Scroll to the Featured Movies row ourselves rather than relying on the
// browser's #hash jump, which doesn't always fire in a single-page app.
function scrollToFeatured(e) {
  const target = document.getElementById("features");
  if (!target) return; // fall back to the normal link behavior
  e.preventDefault();
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  window.history.replaceState(window.history.state, "", "#features");
}

const Landing = () => {
  return (
    <section id="landing" className="hero">
      <img
        className="hero__img"
        src="/assets/family-movie-night-1920.jpg"
        srcSet="/assets/family-movie-night-960.jpg 960w, /assets/family-movie-night-1920.jpg 1920w"
        sizes="100vw"
        alt="A family and their dog on the couch, watching a movie together"
        fetchPriority="high"
        decoding="async"
      />
      <div className="hero__overlay" aria-hidden="true" />

      <div className="hero__content">
        <span className="hero__eyebrow">Movie night, sorted</span>
        <h1 className="hero__title">
          Your <span className="hero__accent">favorite movies</span>, all in one place
        </h1>
        <p className="hero__para">
          Thousands of films for the whole family, from superhero epics to
          animated classics, all at prices everyone will love.
        </p>
        <div className="hero__actions">
          <a href="#features" className="btn hero__btn" onClick={scrollToFeatured}>
            Browse Movies
          </a>
          <Link to="/movies" className="hero__btn--ghost">
            Search the library
          </Link>
        </div>
      </div>

      <a
        className="hero__credit"
        href="https://www.pexels.com/photo/interested-multiracial-family-watching-tv-on-sofa-together-with-dog-4545955/"
        target="_blank"
        rel="noreferrer"
      >
        Photo: Ketut Subiyanto / Pexels
      </a>
    </section>
  );
};

export default Landing;
