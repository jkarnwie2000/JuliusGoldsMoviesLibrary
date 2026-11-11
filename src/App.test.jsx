import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "./App";
import { getMovieById, searchMovies } from "./api";
import { effectivePrice, getPrice } from "./pricing.mjs";

// The movie database is replaced with sample movies so tests never use the network.
jest.mock("./api", () => ({ searchMovies: jest.fn(), getMovieById: jest.fn() }));

const SAMPLE = [
  { imdbID: "tt0372784", Title: "Batman Begins", Year: "2005", rating: "8.2" },
  { imdbID: "tt0468569", Title: "The Dark Knight", Year: "2008", rating: "9.0" },
  { imdbID: "tt1345836", Title: "The Dark Knight Rises", Year: "2012", rating: "8.4" },
  { imdbID: "tt0096895", Title: "Batman", Year: "1989", rating: "7.5" },
  { imdbID: "tt1877830", Title: "The Batman", Year: "2022", rating: "N/A" },
].map((m) => ({ ...m, Poster: `https://img.example.com/${m.imdbID}.jpg` }));

beforeEach(() => {
  searchMovies.mockImplementation(async (_term, { page = 1 } = {}) => (page === 1 ? SAMPLE : []));
  getMovieById.mockImplementation(async (id) => {
    const m = SAMPLE.find((s) => s.imdbID === id);
    return { ...m, imdbRating: m.rating, Rated: "PG-13", Runtime: "140 min", Genre: "Action", Plot: `${m.Title} plot.` };
  });
});

function renderAt(url) {
  window.history.pushState({}, "", url);
  return render(<App />);
}

const priceOf = (id) => effectivePrice(getPrice(id));
const cardTitles = () =>
  [...document.querySelectorAll(".movies .movie__title--link")].map((a) => a.firstChild.textContent.trim());
const card = (title) => screen.getByText(title, { selector: ".movie__title--link *, .movie__title--link" }).closest(".movie");
const cartBadge = () => document.querySelector(".cart__length")?.textContent ?? "0";

describe("Home page", () => {
  it("shows the hero buttons and the admin link", async () => {
    renderAt("/");
    expect(screen.getByRole("link", { name: "Browse Movies" })).toHaveAttribute("href", "#features");
    expect(screen.getByRole("link", { name: "Search the library" })).toHaveAttribute("href", "/movies");
    expect(screen.getByRole("link", { name: /admin login/i })).toHaveAttribute("href", "/admin");
    expect(await screen.findByRole("heading", { name: "Featured Movies" })).toBeInTheDocument();
  });

  it("lists movies with prices and an Add to Cart button in each row", async () => {
    renderAt("/");
    const featured = (await screen.findByRole("heading", { name: "Featured Movies" })).closest("section");
    await within(featured).findAllByRole("button", { name: /add to cart/i });
    expect(within(featured).getAllByRole("button", { name: /add to cart/i })).toHaveLength(SAMPLE.length);
  });
});

describe("Movies page", () => {
  it("shows search results with prices and IMDb ratings", async () => {
    renderAt("/movies?q=batman");
    expect(await screen.findByRole("heading", { name: /Results for "batman"/ })).toBeInTheDocument();
    expect(await screen.findByText("5 movies")).toBeInTheDocument();
    expect(cardTitles()).toEqual(SAMPLE.map((m) => m.Title));

    const begins = card("Batman Begins");
    expect(await within(begins).findByText("8.2")).toBeInTheDocument();
    expect(within(begins).getByText(`$${priceOf("tt0372784").toFixed(2)}`)).toBeInTheDocument();
    expect(await within(card("The Batman")).findByText("No rating yet")).toBeInTheDocument();
  });

  it("sorts by price and by rating, both directions", async () => {
    renderAt("/movies?q=batman");
    await screen.findByText("5 movies");
    await within(card("Batman Begins")).findByText("8.2"); // ratings loaded
    const sort = screen.getByRole("combobox");

    const byPrice = [...SAMPLE].sort((a, b) => priceOf(a.imdbID) - priceOf(b.imdbID)).map((m) => m.Title);
    fireEvent.change(sort, { target: { value: "PRICE_LOW" } });
    expect(cardTitles().map((t) => priceOf(SAMPLE.find((m) => m.Title === t).imdbID)))
      .toEqual(byPrice.map((t) => priceOf(SAMPLE.find((m) => m.Title === t).imdbID)));

    fireEvent.change(sort, { target: { value: "PRICE_HIGH" } });
    const prices = cardTitles().map((t) => priceOf(SAMPLE.find((m) => m.Title === t).imdbID));
    expect(prices).toEqual([...prices].sort((a, b) => b - a));

    fireEvent.change(sort, { target: { value: "RATING_HIGH" } });
    expect(cardTitles()).toEqual(["The Dark Knight", "The Dark Knight Rises", "Batman Begins", "Batman", "The Batman"]);

    fireEvent.change(sort, { target: { value: "RATING_LOW" } });
    // Unrated movies always go last, in either direction.
    expect(cardTitles()).toEqual(["Batman", "Batman Begins", "The Dark Knight Rises", "The Dark Knight", "The Batman"]);
    expect(window.location.search).toContain("sort=RATING_LOW");
  });

  it("searches when you submit, and says when nothing matches", async () => {
    renderAt("/movies");
    await screen.findByText("5 movies");
    searchMovies.mockImplementation(async () => []);
    fireEvent.change(screen.getByRole("textbox", { name: "Search movies" }), { target: { value: "zzzzzz" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText('No movies found for "zzzzzz".')).toBeInTheDocument();
    expect(searchMovies).toHaveBeenCalledWith("zzzzzz", expect.objectContaining({ page: 1 }));
  });

  it("shows an error message if the movie database fails", async () => {
    searchMovies.mockRejectedValue(new Error("limit reached"));
    renderAt("/movies?q=batman");
    expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument();
  });
});

describe("Shopping without leaving the page", () => {
  it("adds movies from the cards, with a confirmation and a quantity control", async () => {
    renderAt("/movies?q=batman");
    await screen.findByText("5 movies");

    fireEvent.click(within(card("Batman Begins")).getByRole("button", { name: /add to cart/i }));
    expect(screen.getByRole("status")).toHaveTextContent("Added Batman Begins to your cart");
    expect(within(screen.getByRole("status")).getByRole("link", { name: "View cart" })).toHaveAttribute("href", "/cart");
    expect(window.location.pathname).toBe("/movies"); // stayed on the page
    expect(cartBadge()).toBe("1");

    fireEvent.click(within(card("Batman Begins")).getByRole("button", { name: "Add another Batman Begins" }));
    expect(within(card("Batman Begins")).getByText(/2 in cart/)).toBeInTheDocument();
    fireEvent.click(within(card("The Dark Knight")).getByRole("button", { name: /add to cart/i }));
    expect(cartBadge()).toBe("3");

    fireEvent.click(within(card("The Dark Knight")).getByRole("button", { name: "Remove The Dark Knight from cart" }));
    expect(within(card("The Dark Knight")).getByRole("button", { name: /add to cart/i })).toBeInTheDocument();
    expect(cartBadge()).toBe("2");

    // The cart is saved in the browser so it survives reloads and the trip to Stripe.
    expect(JSON.parse(localStorage.getItem("jg-movies-cart"))).toEqual([
      expect.objectContaining({ id: "tt0372784", Title: "Batman Begins", quantity: 2 }),
    ]);
  });

  it("hides the confirmation after a few seconds", async () => {
    jest.useFakeTimers();
    try {
      renderAt("/movies?q=batman");
      await act(async () => { await Promise.resolve(); });
      await screen.findByText("5 movies");
      fireEvent.click(within(card("Batman")).getByRole("button", { name: /add to cart/i }));
      expect(screen.getByRole("status")).toBeInTheDocument();
      act(() => jest.advanceTimersByTime(4000));
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it("offers Continue shopping and View cart on a movie's page", async () => {
    renderAt("/movies?q=batman");
    await screen.findByText("5 movies");
    fireEvent.click(within(card("The Dark Knight Rises")).getAllByRole("link")[0]);

    expect(await screen.findByRole("heading", { name: "The Dark Knight Rises" })).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalled(); // opened at the top of the page
    expect(document.querySelector(".movie__selected")).toHaveClass("slide-up");
    expect(screen.getByText("2012 • PG-13 • 140 min • Action")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));
    expect(screen.getByRole("link", { name: /view cart & checkout/i })).toHaveAttribute("href", "/cart");

    fireEvent.click(screen.getByRole("button", { name: /continue shopping/i }));
    await waitFor(() => expect(window.location.pathname + window.location.search).toBe("/movies?q=batman"));
    expect(await screen.findByText(/1 in cart/)).toBeInTheDocument();
  });
});

describe("Cart page", () => {
  it("shows subtotal, 10% tax, the $4.99 mailing fee and the total", async () => {
    localStorage.setItem("jg-movies-cart", JSON.stringify([
      { id: "tt0848228", Title: "The Avengers", Poster: "", ...getPrice("tt0848228"), quantity: 1 },
      { id: "tt0892769", Title: "How to Train Your Dragon", Poster: "", ...getPrice("tt0892769"), quantity: 2 },
    ]));
    renderAt("/cart");
    const totals = await screen.findByText("Total");
    const box = totals.closest(".total");
    expect(within(box).getByText("$59.97")).toBeInTheDocument();
    expect(within(box).getByText("Tax (10%)").nextSibling).toHaveTextContent("$6.00");
    expect(within(box).getByText("Mailing fee").nextSibling).toHaveTextContent("$4.99");
    expect(totals.nextSibling).toHaveTextContent("$70.96");
    // Movies without a poster get a placeholder instead of a broken image.
    expect(document.querySelectorAll(".cart__movie--noimg")).toHaveLength(2);
    expect(document.querySelector('img[src=""]')).toBeNull();
  });

  it("shows a friendly empty state", async () => {
    renderAt("/cart");
    expect(await screen.findByText("You don't have any movies in your cart!")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /proceed to checkout/i })).not.toBeInTheDocument();
  });
});
