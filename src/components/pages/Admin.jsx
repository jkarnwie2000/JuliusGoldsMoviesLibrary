import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const SESSION_KEY = "jg-admin-session";

const money = (cents) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents || 0) / 100);
const number = (n) => new Intl.NumberFormat("en-US").format(n || 0);
const dateTime = (ms) =>
  new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// The signed-in session ({ token, email, expiresAt }) is kept in this browser
// until it expires or you sign out.
function readSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    return s && s.token && s.expiresAt > Date.now() ? s : null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
}

async function postJson(url, body, token) {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    ...(body && { body: JSON.stringify(body) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Request failed"), { status: res.status });
  return data;
}

const adminFetch = (token, body) => postJson("/api/admin", body, token);
const authAction = (body) => postJson("/api/auth", body);

// ---------- Sign in / create account / reset password ----------
const AdminAuth = ({ onSignedIn, notice }) => {
  const [mode, setMode] = useState("signin"); // signin | request | verify
  const [purpose, setPurpose] = useState("create"); // create | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState(notice || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const MIN = 10;

  const go = (next, nextPurpose) => {
    setMode(next);
    if (nextPurpose) setPurpose(nextPurpose);
    setError("");
    setMessage("");
  };

  async function run(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const signIn = (e) => {
    e.preventDefault();
    run(async () => onSignedIn(await authAction({ action: "login", email, password })));
  };

  const requestCode = (e) => {
    e?.preventDefault();
    run(async () => {
      const result = await authAction({ action: "request-code", email });
      setMode("verify");
      setMessage(result.message);
    });
  };

  const setNew = (e) => {
    e.preventDefault();
    if (newPassword.length < MIN) return setError(`Password must be at least ${MIN} characters.`);
    if (newPassword !== confirm) return setError("The two passwords don't match.");
    run(async () => onSignedIn(await authAction({ action: "set-password", email, code, password: newPassword })));
  };

  const title =
    mode === "signin" ? "Admin sign in" : purpose === "create" ? "Create your admin account" : "Reset your password";

  return (
    <main className="admin admin--login">
      <div className="admin__login">
        <FontAwesomeIcon icon="lock" className="admin__login--icon" />
        <h2>{title}</h2>

        {message && <p className="admin__notice">{message}</p>}

        {mode === "signin" && (
          <form onSubmit={signIn} className="admin__form">
            <label htmlFor="admin-email">Email</label>
            <input id="admin-email" type="email" autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)} required autoFocus />
            <label htmlFor="admin-password">Password</label>
            <input id="admin-password" type="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} required />
            {error && <p className="admin__error">{error}</p>}
            <button className="btn" type="submit" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
            <div className="admin__links">
              <button type="button" className="admin__link" onClick={() => go("request", "create")}>Create an account</button>
              <button type="button" className="admin__link" onClick={() => go("request", "reset")}>Forgot password?</button>
            </div>
          </form>
        )}

        {mode === "request" && (
          <form onSubmit={requestCode} className="admin__form">
            <p className="admin__hint">
              {purpose === "create"
                ? "Admin accounts are limited to the business's approved email. We'll email you a 6-digit code to confirm it's you."
                : "Enter your admin email and we'll send a 6-digit code so you can choose a new password."}
            </p>
            <label htmlFor="admin-email2">Email</label>
            <input id="admin-email2" type="email" autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)} required autoFocus />
            {error && <p className="admin__error">{error}</p>}
            <button className="btn" type="submit" disabled={busy}>{busy ? "Sending..." : "Email me a code"}</button>
            <div className="admin__links">
              <button type="button" className="admin__link" onClick={() => go("signin")}>Back to sign in</button>
            </div>
          </form>
        )}

        {mode === "verify" && (
          <form onSubmit={setNew} className="admin__form">
            <label htmlFor="admin-code">6-digit code</label>
            <input id="admin-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required autoFocus
              className="admin__code" />
            <label htmlFor="admin-new">{purpose === "create" ? "Choose a password" : "New password"}</label>
            <input id="admin-new" type="password" autoComplete="new-password" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)} required />
            <span className={`admin__rule ${newPassword.length >= MIN ? "admin__rule--ok" : ""}`}>
              <FontAwesomeIcon icon={newPassword.length >= MIN ? "circle-check" : "circle-exclamation"} /> At least {MIN} characters
            </span>
            <label htmlFor="admin-confirm">Confirm password</label>
            <input id="admin-confirm" type="password" autoComplete="new-password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} required />
            {error && <p className="admin__error">{error}</p>}
            <button className="btn" type="submit" disabled={busy || code.length !== 6}>
              {busy ? "Saving..." : purpose === "create" ? "Create account" : "Reset password"}
            </button>
            <div className="admin__links">
              <button type="button" className="admin__link" onClick={requestCode} disabled={busy}>Send a new code</button>
              <button type="button" className="admin__link" onClick={() => go("signin")}>Back to sign in</button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
};

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
  const [session, setSession] = useState(readSession);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(readSession() ? "loading" : "login");
  const [error, setError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [resend, setResend] = useState({}); // orderId -> { state: "sending" | "sent" | "error", text }

  async function resendEmails(orderId) {
    setResend((r) => ({ ...r, [orderId]: { state: "sending" } }));
    try {
      const result = await adminFetch(session.token, { action: "resend-emails", orderId });
      const text = result.failures?.length
        ? `Sent ${result.sent} of ${result.attempted} (${result.failures.map((f) => f.to).join(", ")} failed)`
        : `Sent ${result.sent} email${result.sent === 1 ? "" : "s"}`;
      setResend((r) => ({ ...r, [orderId]: { state: result.failures?.length ? "error" : "sent", text } }));
    } catch (err) {
      if (err.status === 401 || err.status === 403) return signOut(err.message);
      setResend((r) => ({ ...r, [orderId]: { state: "error", text: err.message } }));
    }
  }

  const signOut = useCallback((notice = "") => {
    saveSession(null);
    setSession(null);
    setData(null);
    setAuthNotice(notice);
    setStatus("login");
  }, []);

  const load = useCallback(
    async (s) => {
      setStatus("loading");
      setError("");
      try {
        setData(await adminFetch(s.token));
        setStatus("ready");
      } catch (err) {
        if (err.status === 401 || err.status === 403) return signOut(err.message);
        setError(err.message);
        setStatus("error");
      }
    },
    [signOut]
  );

  useEffect(() => {
    const saved = readSession();
    if (saved) load(saved);
  }, [load]);

  function handleSignedIn(newSession) {
    saveSession(newSession);
    setSession(newSession);
    setAuthNotice("");
    load(newSession);
  }

  async function connectWebhook() {
    setConnecting(true);
    try {
      await adminFetch(session.token, { action: "connect-webhook" });
      await load(session);
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

  if (status === "login" || !session) {
    return <AdminAuth onSignedIn={handleSignedIn} notice={authNotice} />;
  }

  if (status === "loading" && !data) {
    return <p className="movies__message">Loading dashboard...</p>;
  }

  if (status === "error" && !data) {
    return (
      <main className="admin">
        <p className="admin__error">{error}</p>
        <button className="btn" onClick={() => load(session)}>Try again</button>
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
          <p className="admin__signed-in">Signed in as {data.signedInAs || session.email}</p>
        </div>
        <div className="admin__actions">
          <button className="admin__btn" onClick={() => load(session)} disabled={status === "loading"}>
            {status === "loading" ? "Refreshing..." : "Refresh"}
          </button>
          <button className="admin__btn admin__btn--ghost" onClick={() => signOut()}>Sign out</button>
        </div>
      </div>

      {error && <p className="admin__error">{error}</p>}

      {setup.webhookJustConnected && (
        <p className="admin__notice admin__notice--page">
          <FontAwesomeIcon icon="circle-check" /> Order emails are now connected. New orders will email the buyer
          and {setup.businessEmail}. For earlier orders, use <strong>Resend emails</strong> below.
        </p>
      )}

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
                    <th>Emails</th>
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
                      <td className="nowrap">
                        <button
                          className="admin__btn admin__btn--small admin__btn--ghost"
                          onClick={() => resendEmails(o.id)}
                          disabled={resend[o.id]?.state === "sending"}
                        >
                          {resend[o.id]?.state === "sending" ? "Sending..." : "Resend emails"}
                        </button>
                        {resend[o.id]?.text && (
                          <span className={`admin__resend admin__resend--${resend[o.id].state}`}>
                            <FontAwesomeIcon icon={resend[o.id].state === "sent" ? "circle-check" : "circle-exclamation"} />{" "}
                            {resend[o.id].text}
                          </span>
                        )}
                      </td>
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
