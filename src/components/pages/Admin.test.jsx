import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Admin from "./Admin";

// Routes fake API responses by URL and action.
function mockApi(handlers) {
  global.fetch = jest.fn(async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : {};
    const key = `${url}${body.action ? `:${body.action}` : ""}`;
    const [status, json] = handlers[key] ? handlers[key](body, options) : [404, { error: `no mock for ${key}` }];
    return { ok: status < 400, status, json: async () => json };
  });
}

const DASHBOARD = {
  signedInAs: "owner@example.com",
  orders: [
    {
      id: "cs_test_1", created: Date.now(), livemode: false, paymentStatus: "paid",
      email: "ada@example.com", customerName: "Ada Lovelace",
      shipping: { city: "Austin", state: "TX", country: "US", lines: [] },
      items: [{ name: "The Avengers (2012)", quantity: 2, amountCents: 1998 }],
      subtotalCents: 1998, taxCents: 200, mailingCents: 499, totalCents: 2697, currency: "usd",
    },
  ],
  setup: { stripeMode: "test", emailsConfigured: true, businessEmail: "owner@example.com", webhookConnected: true },
};

const renderAdmin = () => render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Admin /></MemoryRouter>);
const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("Admin sign in", () => {
  it("signs in and shows the dashboard figures", async () => {
    mockApi({
      "/api/auth:login": () => [200, { token: "tok", email: "owner@example.com", expiresAt: Date.now() + 3600e3 }],
      "/api/admin": (_b, opts) => (opts.headers.Authorization === "Bearer tok" ? [200, DASHBOARD] : [401, {}]),
    });
    renderAdmin();
    fill("Email", "owner@example.com");
    fill("Password", "a-strong-password");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Signed in as owner@example.com")).toBeInTheDocument();
    const revenue = screen.getByText("Revenue", { selector: ".admin__tile--label" }).closest(".admin__tile");
    expect(within(revenue).getByText("$26.97")).toBeInTheDocument();
    expect(screen.getByText("The Avengers (2012) × 2")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("jg-admin-session")).token).toBe("tok");
  });

  it("shows the server's message for a wrong password", async () => {
    mockApi({ "/api/auth:login": () => [401, { error: "Incorrect email or password." }] });
    renderAdmin();
    fill("Email", "owner@example.com");
    fill("Password", "wrong");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Incorrect email or password.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Dashboard" })).not.toBeInTheDocument();
  });
});

describe("Creating an account", () => {
  async function reachCodeStep() {
    mockApi({
      "/api/auth:request-code": () => [200, { ok: true, message: "If that email is approved for admin access, a 6-digit code is on its way." }],
      "/api/auth:set-password": (body) =>
        body.code === "123456" ? [200, { token: "new", email: body.email, expiresAt: Date.now() + 3600e3 }] : [400, { error: "That code is incorrect." }],
      "/api/admin": () => [200, DASHBOARD],
    });
    renderAdmin();
    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    expect(screen.getByRole("heading", { name: "Create your admin account" })).toBeInTheDocument();
    fill("Email", "owner@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Email me a code" }));
    await screen.findByLabelText("6-digit code");
  }

  it("emails a code, then creates the account and signs in", async () => {
    await reachCodeStep();
    expect(screen.getByText(/a 6-digit code is on its way/)).toBeInTheDocument();
    fill("6-digit code", "12a34-56"); // non-digits are stripped
    expect(screen.getByLabelText("6-digit code")).toHaveValue("123456");
    fill("Choose a password", "my-secure-pass");
    fill("Confirm password", "my-secure-pass");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();

    const setCall = fetch.mock.calls.find(([, o]) => o?.body?.includes("set-password"));
    expect(JSON.parse(setCall[1].body)).toEqual({
      action: "set-password", email: "owner@example.com", code: "123456", password: "my-secure-pass",
    });
  });

  it("checks the password rules before contacting the server", async () => {
    await reachCodeStep();
    fill("6-digit code", "123456");
    fill("Choose a password", "short");
    fill("Confirm password", "short");
    expect(screen.getByText(/At least 10 characters/)).not.toHaveClass("admin__rule--ok");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByText("Password must be at least 10 characters.")).toBeInTheDocument();

    fill("Choose a password", "long-enough-pass");
    fill("Confirm password", "different-pass!!");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByText("The two passwords don't match.")).toBeInTheDocument();
    expect(fetch.mock.calls.some(([, o]) => o?.body?.includes("set-password"))).toBe(false);
  });

  it("shows a wrong-code error from the server", async () => {
    await reachCodeStep();
    fill("6-digit code", "999999");
    fill("Choose a password", "my-secure-pass");
    fill("Confirm password", "my-secure-pass");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("That code is incorrect.")).toBeInTheDocument();
  });
});

describe("Dashboard", () => {
  beforeEach(() => {
    localStorage.setItem("jg-admin-session", JSON.stringify({ token: "tok", email: "owner@example.com", expiresAt: Date.now() + 3600e3 }));
  });

  it("resends an order's emails and reports the result", async () => {
    mockApi({
      "/api/admin": () => [200, DASHBOARD],
      "/api/admin:resend-emails": (body) => [200, { attempted: 2, sent: 2, failures: [], orderId: body.orderId }],
    });
    renderAdmin();
    fireEvent.click(await screen.findByRole("button", { name: "Resend emails" }));
    expect(await screen.findByText("Sent 2 emails")).toBeInTheDocument();
  });

  it("signs out when the session has expired", async () => {
    mockApi({ "/api/admin": () => [401, { error: "Your session expired. Please sign in again." }] });
    renderAdmin();
    expect(await screen.findByText("Your session expired. Please sign in again.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Admin sign in" })).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem("jg-admin-session")).toBeNull());
  });
});
