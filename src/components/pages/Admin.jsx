import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const SESSION_KEY = "jg-admin-pass";

const money = (cents) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents || 0) / 100);
const number = (n) => new Intl.NumberFormat("en-US").format(n || 0);
const dateTime = (ms) =>
  new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function readSaved() {
  try {
    return sessionStorage.getItem(SESSION_KEY) || "";
  } catch {
    return "";
  }
}

async function adminFetch(password, options = {}) {
  const res = await fetch("/api/admin", {
    ...options,
    headers: { "Content-Type": "application/json", "x-admin-password": password, ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Request failed"), { status: res.status });
  return data;
}

const StatTile = ({ label, value }) => (
  <div className="admin__tile">
    <span className="admin__tile--label">{label}</span>
    <span className="admin__tile--value">{value}</span>
  </div>
);

const Check = ({ ok, children }) => (
  <li className={`admin__check ${ok ? "admin__check--ok" : "admin__check--todo"}`}>
    <FontAwesomeIcon icon={ok ? "circle-check" : "circle-exclamation"} />
    <span>
      <strong>{ok ? "Done" : "To do"}:</strong> {children}
    </span>
  </li>
);

const Admin = () => {
  const [password, setPassword] = useState(readSaved);
  const [input, setInput] = useState("");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(readSaved() ? "loading" : "login");
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);

  const load = useCallback(async (pass) => {
    setStatus("loading");
    setError("");
    try {
      const result = await adminFetch(pass);
      setData(result);
      setPassword(pass);
      try {
        sessionStorage.setItem(SESSION_KEY, pass);
      } catch {}
      setStatus("ready");
    } catch (err) {
      setError(err.message);
      if (err.status === 401 || err.status === 503) {
        try {
          sessionStorage.removeItem(SESSION_KEY);
        } catch {}
        setStatus("login");
      } else {
        setStatus("error");
      }
    }
  }, []);

  useEffect(() => {
    const saved = readSaved();
    if (saved) load(saved);
  }, [load]);

  function signOut() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {}
    setPassword("");
    setData(null);
    setStatus("login");
  }

  async function connectWebhook() {
    setConnecting(true);
    try {
      await adminFetch(password, { method: "POST", body: JSON.stringify({ action: "connect-webhook" }) });
      await load(password);
    } catch (err) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  }

  const stats = useMemo(() => {
    const orders = data?.orders || [];
    const sum = (key) => orders.reduce((s, o) => s + (o[key] || 0), 0);
    const movies = new Map();
    orders.forEach((o) =>
      o.items.forEach((i) => {
        const m = movies.get(i.name) || { name: i.name, units: 0, revenueCents: 0 };
        m.units += i.quantity;
        m.revenueCents += i.amountCents;
        movies.set(i.name, m);
      })
    );
    const revenue = sum("totalCents");
    return {
      orders,
      revenue,
      count: orders.length,
      average: orders.length ? Math.round(revenue / orders.length) : 0,
      unitsSold: [...movies.values()].reduce((s, m) => s + m.units, 0),
      tax: sum("taxCents"),
      mailing: sum("mailingCents"),
      topMovies: [...movies.values()].sort((a, b) => b.units - a.units || b.revenueCents - a.revenueCents).slice(0, 10),
    };
  }, [data]);

  if (status === "login") {
    return (
      <main className="admin admin--login">
        <form
          className="admin__login"
          onSubmit={(e) => {
            e.preventDefault();
            if (input) load(input);
          }}
        >
          <FontAwesomeIcon icon="lock" className="admin__login--icon" />
          <h2>Admin dashboard</h2>
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
          {error && <p className="admin__error">{error}</p>}
          <button className="btn" type="submit">Sign in</button>
        </form>
      </main>
    );
  }

  if (status === "loading" && !data) {
    return <p className="movies__message">Loading dashboard...</p>;
  }

  if (status === "error" && !data) {
    return (
      <main className="admin">
        <p className="admin__error">{error}</p>
        <button className="btn" onClick={() => load(password)}>Try again</button>
      </main>
    );
  }

  const setup = data.setup;
  const allSet = setup.emailsConfigured && setup.businessEmail && setup.webhookConnected;

  return (
    <main className="admin">
      <div className="admin__header">
        <div>
          <h1 className="admin__title">Dashboard</h1>
          <p className="admin__subtitle">
            Last {number(stats.count)} paid orders from Stripe{" "}
            <span className={`admin__badge admin__badge--${setup.stripeMode}`}>
              {setup.stripeMode === "live" ? "Live mode" : "Test mode"}
            </span>
          </p>
        </div>
        <div className="admin__actions">
          <button className="admin__btn" onClick={() => load(password)} disabled={status === "loading"}>
            {status === "loading" ? "Refreshing..." : "Refresh"}
          </button>
          <button className="admin__btn admin__btn--ghost" onClick={signOut}>Sign out</button>
        </div>
      </div>

      {error && <p className="admin__error">{error}</p>}

      {!allSet && (
        <section className="admin__card admin__setup">
          <h2 className="admin__card-title">Finish setting up order emails</h2>
          <ul>
            <Check ok={setup.emailsConfigured}>Resend API key added to Vercel (RESEND_API_KEY)</Check>
            <Check ok={Boolean(setup.businessEmail)}>
              Business email set (BUSINESS_EMAIL){setup.businessEmail && `: ${setup.businessEmail}`}
            </Check>
            <Check ok={setup.webhookConnected}>
              Stripe notifies this site when an order is paid{" "}
              {!setup.webhookConnected && (
                <button className="admin__btn admin__btn--small" onClick={connectWebhook} disabled={connecting}>
                  {connecting ? "Connecting..." : "Connect now"}
                </button>
              )}
            </Check>
          </ul>
        </section>
      )}

      <section className="admin__tiles" aria-label="Key figures">
        <StatTile label="Revenue" value={money(stats.revenue)} />
        <StatTile label="Orders" value={number(stats.count)} />
        <StatTile label="Average order" value={money(stats.average)} />
        <StatTile label="Movies sold" value={number(stats.unitsSold)} />
        <StatTile label="Tax collected" value={money(stats.tax)} />
        <StatTile label="Mailing fees" value={money(stats.mailing)} />
      </section>

      <div className="admin__grid">
        <section className="admin__card">
          <h2 className="admin__card-title">Top movies</h2>
          {stats.topMovies.length === 0 ? (
            <p className="admin__empty">No sales yet.</p>
          ) : (
            <table className="admin__table">
              <thead>
                <tr>
                  <th>Movie</th>
                  <th className="num">Sold</th>
                  <th className="num">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {stats.topMovies.map((m) => (
                  <tr key={m.name}>
                    <td>{m.name}</td>
                    <td className="num">{number(m.units)}</td>
                    <td className="num">{money(m.revenueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="admin__card admin__card--wide">
          <h2 className="admin__card-title">Recent orders</h2>
          {stats.orders.length === 0 ? (
            <p className="admin__empty">No orders yet.</p>
          ) : (
            <div className="admin__table-wrap">
              <table className="admin__table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Movies</th>
                    <th>Ship to</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.orders.map((o) => (
                    <tr key={o.id}>
                      <td className="nowrap">{dateTime(o.created)}</td>
                      <td>
                        {o.customerName || "—"}
                        <span className="admin__muted">{o.email}</span>
                      </td>
                      <td>
                        {o.items.map((i) => (
                          <span className="admin__item" key={i.name}>
                            {i.name} &times; {i.quantity}
                          </span>
                        ))}
                      </td>
                      <td>
                        {o.shipping
                          ? [o.shipping.city, o.shipping.state, o.shipping.country].filter(Boolean).join(", ")
                          : "—"}
                      </td>
                      <td className="num">{money(o.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

export default Admin;
