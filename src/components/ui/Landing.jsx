
const Landing = () => {
  return (
    <section id='landing'>
        <header>
            <div className='header__container'>
                <div className='header__description'>
                    <h2>Your favorite movies</h2>
                    <a href="/#features">                    
                    <button className='btn'>Browse Movies</button>                                      
                    </a>
                </div>
                <figure className='header__img--wrapper'>
                    <img src="/assets/hero-cinema.svg" alt="Cinema screen framed by red curtains with popcorn and a clapperboard" className="header__img" />
                </figure>
            </div>
        </header>
    </section>
  )
}

export default Landing