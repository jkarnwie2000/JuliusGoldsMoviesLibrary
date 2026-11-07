import { Link, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFacebookF,
  faInstagram,
  faTiktok,
  faXTwitter,
  faYoutube,
} from "@fortawesome/free-brands-svg-icons";

// Placeholder links: replace each `url` with your real profile address.
const SOCIAL_LINKS = [
  { name: "Facebook", icon: faFacebookF, url: "https://www.facebook.com/" },
  { name: "Instagram", icon: faInstagram, url: "https://www.instagram.com/" },
  { name: "X", icon: faXTwitter, url: "https://x.com/" },
  { name: "YouTube", icon: faYoutube, url: "https://www.youtube.com/" },
  { name: "TikTok", icon: faTiktok, url: "https://www.tiktok.com/" },
];

// True when this browser has an unexpired admin sign-in (saved by the Admin page).
function isAdminSignedIn() {
  try {
    const s = JSON.parse(localStorage.getItem("jg-admin-session"));
    return Boolean(s?.token && s.expiresAt > Date.now());
  } catch {
    return false;
  }
}

const Footer = () => {
  useLocation(); // re-check the sign-in each time the page changes
  const signedIn = isAdminSignedIn();
  return (
    <footer>
      <div className="container">
        <div className="row row__column">
          <Link to="/" className="footer__logo">
            <figure>
              <img src="/assets/logo.svg" alt="Julius Gold's Movies Library" className="footer__logo--img" />
            </figure>
          </Link>
          <div className="footer__list">
            <Link to="/" className="footer__link">Home</Link>
            <span className="footer__link no-cursor">About</span>
            <Link to="/movies" className="footer__link">Movies</Link>
            <Link to="/cart" className="footer__link">Cart</Link>
          </div>
          <ul className="footer__social" aria-label="Follow us on social media">
            {SOCIAL_LINKS.map(({ name, icon, url }) => (
              <li key={name}>
                <a
                  href={url}
                  className="footer__social--link"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Julius Gold's Movies on ${name}`}
                  title={name}
                >
                  <FontAwesomeIcon icon={icon} />
                </a>
              </li>
            ))}
          </ul>
          <div className="footer__copyright">
            Copyright &copy; {new Date().getFullYear()} Julius Gold's Movies
          </div>
          <Link to="/admin" className="footer__admin" rel="nofollow">
            <FontAwesomeIcon icon="lock" /> {signedIn ? "Admin dashboard" : "Admin login"}
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
