import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Cart from "./Cart";
import CheckoutSuccess from "./CheckoutSuccess";
import { getPrice } from "../../pricing.mjs";

const CART = [
  { id: "tt0848228", Title: "The Avengers", Poster: "", ...getPrice("tt0848228"), quantity: 1 },
  { id: "tt0892769", Title: "How to Train Your Dragon", Poster: "", ...getPrice("tt0892769"), quantity: 2 },
];

const jsonResponse = (body, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, json: async () => body });

function renderCart(url = "/cart", cart = CART) {
  return render(
    <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Cart cart={cart} changeQuantity={jest.fn()} removeItem={jest.fn()} />
    </MemoryRouter>
  );
}

describe("Proceed to Checkout", () => {
  const realLocation = window.location;
  beforeEach(() => {
    delete window.location;
    window.location = { ...realLocation, assign: jest.fn() };
  });
  afterEach(() => {
    window.location = realLocation;
  });

  it("sends only movie IDs and quantities to the server, then goes to Stripe", async () => {
    global.fetch = jest.fn(() => jsonResponse({ url: "https://checkout.stripe.com/c/pay/cs_test_123" }));
    renderCart();

    fireEvent.click(screen.getByRole("button", { name: /proceed to checkout/i }));
    expect(screen.getByRole("button", { name: /redirecting to secure checkout/i })).toBeDisabled();

    await waitFor(() => expect(window.location.assign).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/cs_test_123"));
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("/api/checkout");
    expect(JSON.parse(options.body)).toEqual({
      items: [{ id: "tt0848228", quantity: 1 }, { id: "tt0892769", quantity: 2 }], // no prices sent
    });
  });

  it("shows the server's error and lets the shopper try again", async () => {
    global.fetch = jest.fn(() => jsonResponse({ error: "Payments are not set up yet." }, false));
    renderCart();
    fireEvent.click(screen.getByRole("button", { name: /proceed to checkout/i }));
    expect(await screen.findByText("Payments are not set up yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /proceed to checkout/i })).toBeEnabled();
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it("explains that a canceled checkout wasn't charged", () => {
    renderCart("/cart?canceled=1");
    expect(screen.getByText(/Checkout was canceled and you haven't been charged/)).toBeInTheDocument();
  });

  it("leaves out movies set to quantity 0", async () => {
    global.fetch = jest.fn(() => jsonResponse({ url: "https://checkout.stripe.com/x" }));
    renderCart("/cart", [CART[0], { ...CART[1], quantity: 0 }]);
    fireEvent.click(screen.getByRole("button", { name: /proceed to checkout/i }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(JSON.parse(fetch.mock.calls[0][1].body).items).toEqual([{ id: "tt0848228", quantity: 1 }]);
  });
});

describe("Order confirmation page", () => {
  const renderSuccess = (url, clearCart = jest.fn()) => {
    render(
      <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <CheckoutSuccess clearCart={clearCart} />
      </MemoryRouter>
    );
    return clearCart;
  };

  it("confirms a paid order and empties the cart", async () => {
    global.fetch = jest.fn(() =>
      jsonResponse({ paymentStatus: "paid", amountTotal: 7096, currency: "usd", email: "buyer@example.com" })
    );
    const clearCart = renderSuccess("/checkout/success?session_id=cs_test_abc");
    expect(await screen.findByRole("heading", { name: "Thank you for your order!" })).toBeInTheDocument();
    expect(screen.getByText("$70.96")).toBeInTheDocument();
    expect(screen.getByText(/confirmation email is on its way to/)).toHaveTextContent("buyer@example.com");
    expect(clearCart).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe("/api/checkout-session?session_id=cs_test_abc");
  });

  it("keeps the cart while a payment is still processing", async () => {
    global.fetch = jest.fn(() => jsonResponse({ paymentStatus: "unpaid", amountTotal: 7096 }));
    const clearCart = renderSuccess("/checkout/success?session_id=cs_test_abc");
    expect(await screen.findByRole("heading", { name: "Your payment is processing" })).toBeInTheDocument();
    expect(clearCart).not.toHaveBeenCalled();
  });

  it("does nothing if someone visits the page without a real order", async () => {
    global.fetch = jest.fn();
    const clearCart = renderSuccess("/checkout/success");
    expect(await screen.findByRole("heading", { name: "We couldn't find that order" })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(clearCart).not.toHaveBeenCalled();
  });
});
