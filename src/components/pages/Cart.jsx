import React from 'react'
import { Link } from 'react-router-dom';

const Cart = ({ cart, changeQuantity, removeItem }) => {
const total = () => {
let price = 0;
cart.forEach((item) => {
    price += +((item.salePrice || item.originalPrice) * item.quantity
).toFixed(2);    
});
return price;
}
  return (
    <div id='movies__body'>
        <main id='movies__main'>
            <div className='movies__container'>
                <div className='row'>
                    <div className='movies__container--top'>
                        <h2 className='cart__title'>Cart</h2>
                    </div>
                    <div className='cart'>
                       <div className='cart__header'>
                        <span className='cart__movie'>Movie</span>
                        <span className='cart__quantity'>Quantity</span>
                        <span className='cart__total'>Price</span>
                       </div>
                       <div className='cart__body'>
                        {
                            cart.map((movie) => {
                                return (
                                    <div className='cart__item' key={movie.id}>
                                        <div className='cart__movie'>
                                            <img src={movie.Poster} 
                                            className='cart__movie--img'
                                            alt="" />
                                            <div className='cart__movie--info'>
                                                <span className='cart__movie--title'>
                                                    {movie.Title}
                                                </span>
                                                <span className='cart__movie--price'>
                                                    ${(movie.salePrice || movie.originalPrice).toFixed(2)}
                                                </span>
                                                <button className='cart__movie--remove' onClick={() => removeItem(movie)}>
                                                    Remove
                                                </button>
                                            </div>                                            
                                        </div>
                                        <div className='cart__quantity'>
                                            <input type="number"
                                            min={0}
                                            max={99}
                                            className='cart__input'
                                            value={movie.quantity}
                                            onChange={(event) => changeQuantity(movie, event.target.value)} 
                                            />
                                        </div>
                                        <div className='cart__total'>
                                            ${((movie.salePrice || movie.originalPrice) * movie.quantity).toFixed(2)}
                                        </div>
                                    </div>
                                );
                            })}
                       </div>
                       {
                        cart.length === 0 && (
                            <div className='cart__empty'>
                                <img src="/assets/empty_cart.svg" alt="" className='cart__empty--img'/>
                                <h2>You don't have any movies in your cart!</h2>
                                <Link to='/movies'>
                                <button className='btn'>Browse Movies</button>                                
                                </Link>
                            </div>
                        )}
                    </div>
                    {cart.length > 0 && (<div className='total'>
                        <div className='total__item total__sub-total'>
                        <span>Subtotal</span>
                        <span>${(total() * 0.9).toFixed(2)}</span>
                        </div>
                        <div className='total__item total__tax'>
                            <span>Tax</span>
                            <span>${(total() * 0.1).toFixed(2)}</span>
                        </div>
                        <div className='total__item total__price'>
                            <span>Total</span>
                            <span>${(total().toFixed(2))}</span>
                        </div>
                        <button className='btn btn__checkout no-cursor'
                        onClick={() => alert(`Haven't gotten around to doing this :(`)}>
                            Proceed to Checkout
                        </button>
                    </div>)}
                </div>
            </div>
        </main>
    </div>
  )
}

export default Cart