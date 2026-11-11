import { render, screen } from "@testing-library/react";
import Price from "./Price";
import Rating from "./Rating";

describe("Price", () => {
  it("shows a regular price", () => {
    render(<Price originalPrice={9.99} salePrice={null} />);
    expect(screen.getByText("$9.99")).toBeInTheDocument();
    expect(screen.queryByText(/% off/)).not.toBeInTheDocument();
  });

  it("shows a sale with the old price, the new price and the discount", () => {
    render(<Price originalPrice={19.99} salePrice={13.99} />);
    expect(screen.getByText("$19.99")).toHaveClass("movie__price--normal"); // struck through
    expect(screen.getByText("$13.99")).toHaveClass("movie__price--sale");
    expect(screen.getByText("30% off")).toBeInTheDocument();
  });

  it("renders nothing without a price", () => {
    const { container } = render(<Price />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Rating", () => {
  const stars = (container) => ({
    full: container.querySelectorAll('[data-icon="star"]').length,
    half: container.querySelectorAll('[data-icon="star-half-stroke"], [data-icon="star-half-alt"]').length,
  });

  it("turns an IMDb score into stars plus the score", () => {
    const { container } = render(<Rating rating={7.8} />);
    expect(stars(container)).toEqual({ full: 4, half: 0 });
    expect(screen.getByText("7.8")).toBeInTheDocument();
    expect(screen.getByTitle("IMDb 7.8/10")).toBeInTheDocument();
  });

  it("shows half stars", () => {
    const { container } = render(<Rating rating={7.2} />);
    expect(stars(container)).toEqual({ full: 3, half: 1 });
  });

  it("says when there's no rating, and shows a placeholder while loading", () => {
    const { rerender, container } = render(<Rating rating={null} />);
    expect(screen.getByText("No rating yet")).toBeInTheDocument();
    rerender(<Rating rating={undefined} />);
    expect(container.querySelector(".movie__ratings--loading")).toBeInTheDocument();
  });
});
