import { beforeEach, describe, expect, it, vi } from "vitest";

// Replace Vercel Blob with an in-memory store so tests never touch real data.
const store = vi.hoisted(() => new Map());
vi.mock("@vercel/blob", () => ({
  get: async (path) => (store.has(path) ? { stream: new Blob([store.get(path)]).stream() } : null),
  put: async (path, body) => store.set(path, String(body)),
  del: async (path) => store.delete(path),
}));

const auth = await import("../api/_lib/auth.mjs");
const OWNER = "owner@example.com";

const rejects = async (promise, status, message) => {
  await expect(promise).rejects.toMatchObject({ status, ...(message && { message: expect.stringMatching(message) }) });
};

// Lets a test request a fresh code without waiting out the 60-second resend limit.
const expireResendTimer = () => {
  for (const [key, value] of store) {
    if (key.startsWith("codes/")) store.set(key, JSON.stringify({ ...JSON.parse(value), sentAt: 0 }));
  }
};

async function createAccount(password = "a-strong-password") {
  const { code } = await auth.issueCode(OWNER);
  return auth.setPasswordWithCode(OWNER, code, password);
}

beforeEach(() => {
  store.clear();
  vi.stubEnv("SESSION_SECRET", "test-secret");
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
  vi.stubEnv("BUSINESS_EMAIL", OWNER);
  vi.stubEnv("ADMIN_EMAILS", "");
});

describe("sign-up codes", () => {
  it("only approved emails receive a code", async () => {
    expect((await auth.issueCode("stranger@example.com")).code).toBeNull();
    const issued = await auth.issueCode("  Owner@Example.com ");
    expect(issued.email).toBe(OWNER);
    expect(issued.code).toMatch(/^\d{6}$/);
  });

  it("stores codes hashed, never in plain text", async () => {
    const { code } = await auth.issueCode(OWNER);
    expect([...store.values()].join()).not.toContain(code);
  });

  it("limits how often a new code can be sent", async () => {
    await auth.issueCode(OWNER);
    await rejects(auth.issueCode(OWNER), 429, /wait a minute/);
  });

  it("rejects invalid email addresses", async () => {
    await rejects(auth.issueCode("not-an-email"), 400);
  });

  it("supports several approved admins via ADMIN_EMAILS", async () => {
    vi.stubEnv("ADMIN_EMAILS", "a@example.com, B@example.com");
    expect(auth.allowedEmails()).toEqual(["a@example.com", "b@example.com"]);
    expect((await auth.issueCode(OWNER)).code).toBeNull(); // ADMIN_EMAILS replaces BUSINESS_EMAIL
  });
});

describe("creating an account", () => {
  it("creates the account, signs in, and never stores the password", async () => {
    const session = await createAccount();
    expect(session.created).toBe(true);
    expect(session.email).toBe(OWNER);
    expect([...store.values()].join()).not.toContain("a-strong-password");
  });

  it("enforces the password rules", async () => {
    const { code } = await auth.issueCode(OWNER);
    await rejects(auth.setPasswordWithCode(OWNER, code, "short"), 400, /at least 10/);
  });

  it("rejects a wrong code and locks the code after 5 wrong tries", async () => {
    const { code } = await auth.issueCode(OWNER);
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await rejects(auth.setPasswordWithCode(OWNER, wrong, "a-strong-password"), 400);
    await rejects(auth.setPasswordWithCode(OWNER, code, "a-strong-password"), 400, /Too many/);
  });

  it("codes can only be used once", async () => {
    const { code } = await auth.issueCode(OWNER);
    await auth.setPasswordWithCode(OWNER, code, "a-strong-password");
    await rejects(auth.setPasswordWithCode(OWNER, code, "another-password"), 400, /expired/);
  });

  it("codes expire after 10 minutes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const { code } = await auth.issueCode(OWNER);
      vi.setSystemTime(Date.now() + 11 * 60e3);
      await rejects(auth.setPasswordWithCode(OWNER, code, "a-strong-password"), 400, /expired/);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("signing in", () => {
  it("accepts the right password (any email capitalization)", async () => {
    await createAccount();
    const session = await auth.login("OWNER@example.com", "a-strong-password");
    expect((await auth.verifySession(`Bearer ${session.token}`)).email).toBe(OWNER);
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    await createAccount();
    await rejects(auth.login(OWNER, "wrong-password"), 401, /Incorrect email or password/);
    await rejects(auth.login("stranger@example.com", "a-strong-password"), 401, /Incorrect email or password/);
  });

  it("locks sign-in for 15 minutes after 5 wrong passwords", async () => {
    await createAccount();
    for (let i = 0; i < 5; i++) await auth.login(OWNER, "wrong").catch(() => {});
    await rejects(auth.login(OWNER, "a-strong-password"), 429, /15 minutes/);
  });
});

describe("sessions", () => {
  it("rejects forged, missing and expired sessions", async () => {
    const { token } = await createAccount();
    const [, signature] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ e: OWNER, v: "x", exp: Date.now() + 1e9 })).toString("base64url");
    await rejects(auth.verifySession(`Bearer ${forgedPayload}.${signature}`), 401);
    await rejects(auth.verifySession(""), 401);

    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(Date.now() + 13 * 3600e3);
      await rejects(auth.verifySession(`Bearer ${token}`), 401, /expired/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("resetting the password signs out old sessions and clears a lockout", async () => {
    const first = await createAccount();
    for (let i = 0; i < 5; i++) await auth.login(OWNER, "wrong").catch(() => {});

    expireResendTimer();
    const { code } = await auth.issueCode(OWNER);
    const reset = await auth.setPasswordWithCode(OWNER, code, "brand-new-password");

    expect(reset.created).toBe(false);
    await rejects(auth.verifySession(`Bearer ${first.token}`), 401);
    await expect(auth.login(OWNER, "brand-new-password")).resolves.toHaveProperty("token");
    await rejects(auth.login(OWNER, "a-strong-password"), 401);
  });

  it("removing an email from the approved list revokes its access", async () => {
    const { token } = await createAccount();
    vi.stubEnv("BUSINESS_EMAIL", "someone-else@example.com");
    await rejects(auth.verifySession(`Bearer ${token}`), 403);
  });
});

describe("configuration", () => {
  it("explains what's missing when not set up", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    await rejects(auth.issueCode(OWNER), 503, /SESSION_SECRET/);
  });
});
