import { Link } from 'react-router-dom'

const Footer = () => {
  return (
    <footer>
    <div className='container'>
        <div className='row row__column'>
            <a href="/" className='footer__logo'>
            <figure>
                <img src="/assets/logo.svg" alt="Julius Gold's Movies Library" className="footer__logo--img" />
            </figure>
            </a>            
            <div className='footer__list'>
                <a href="/" className='footer__link'>Home</a>
                <span className='footer__link no-cursor'>About</span>
                <Link to='/movies' className='footer__link'>Movies</Link>
                <Link to='/cart' className='footer__link'>Cart</Link>
            </div>
            <div className='footer__copyright'>
                Copyright &copy; 2026 Julius Gold's Movies
            </div>
        </div>
    </div>
    </footer>
  )
}

export default Footer