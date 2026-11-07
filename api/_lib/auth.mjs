// Admin accounts, stored in a private Vercel Blob store.
//
// - Only approved emails (ADMIN_EMAILS, comma-separated, or BUSINESS_EMAIL) can
//   create an account, and they must prove ownership with an emailed 6-digit code.
// - Passwords are hashed with scrypt (salted, slow); plain passwords are never stored.
// - Sessions are HMAC-signed tokens (SESSION_SECRET) that expire, and are revoked
//   whenever the password changes.
// - Repeated wrong passwords lock the account temporarily.
import { createHash, createHmac, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { del, get, put } from "@vercel/blob";

const scrypt = promisify(scryptCb);

export const MIN_PASSWORD = 10;
const MAX_PASSWORD = 200;
const SESSION_HOURS = 12;
const CODE_MINUTES = 10;
const CODE_RESEND_SECONDS = 60;
const MAX_CODE_ATTEMPTS = 5;
const MAX_LOGIN_FAILURES = 5;
const LOCK_MINUTES = 15;

export class AuthError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const looksLikeEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;

export function allowedEmails() {
  return (process.env.ADMIN_EMAILS || process.env.BUSINESS_EMAIL || "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
}

export function assertConfigured() {
  const missing = ["SESSION_SECRET", "BLOB_READ_WRITE_TOKEN"].filter((k) => !process.env[k]);
  if (missing.length) throw new AuthError(`Admin accounts aren't set up yet (missing ${missing.join(", ")}).`, 503);
}

// ---------- storage ----------
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const pathFor = (kind, email) => `${kind}/${sha256(email)}.json`;

async function readJson(pathname) {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result) return null;
  return JSON.parse(await new Response(result.stream).text());
}

async function writeJson(pathname, data) {
  await put(pathname, JSON.stringify(data), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

const getAccount = (email) => readJson(pathFor("accounts", email));
const saveAccount = (account) => writeJson(pathFor("accounts", account.email), account);

// ---------- passwords ----------
async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

async function verifyPassword(password, stored) {
  const [, saltB64, hashB64] = String(stored).split("$");
  const expected = Buffer.from(hashB64 || "", "base64");
  const actual = await scrypt(password, Buffer.from(saltB64 || "", "base64"), 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function checkPasswordRules(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    throw new AuthError(`Password must be at least ${MIN_PASSWORD} characters.`);
  }
  if (password.length > MAX_PASSWORD) throw new AuthError("Password is too long.");
}

// ---------- sessions ----------
const b64url = (buf) => Buffer.from(buf).toString("base64url");
const sign = (data) => createHmac("sha256", process.env.SESSION_SECRET).update(data).digest("base64url");

function createSession(account) {
  const payload = b64url(
    JSON.stringify({ e: account.email, v: account.sessionVersion, exp: Date.now() + SESSION_HOURS * 3600e3 })
  );
  return { token: `${payload}.${sign(payload)}`, email: account.email, expiresAt: Date.now() + SESSION_HOURS * 3600e3 };
}

export async function verifySession(authHeader) {
  assertConfigured();
  const token = String(authHeader || "").replace(/^Bearer\s+/i, "");
  const [payload, sig] = token.split(".");
  if (!payload || !sig) throw new AuthError("Please sign in.", 401);
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new AuthError("Please sign in.", 401);
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    throw new AuthError("Please sign in.", 401);
  }
  if (!data.exp || data.exp < Date.now()) throw new AuthError("Your session expired. Please sign in again.", 401);
  if (!allowedEmails().includes(data.e)) throw new AuthError("This account no longer has admin access.", 403);
  const account = await getAccount(data.e);
  if (!account || account.sessionVersion !== data.v) throw new AuthError("Please sign in again.", 401);
  return account;
}

// ---------- verification codes ----------
const hashCode = (email, code) => sha256(`${email}:${code}:${process.env.SESSION_SECRET}`);

// Returns the code to email, or null if one was sent too recently (or the email isn't approved).
export async function issueCode(rawEmail) {
  assertConfigured();
  const email = normalizeEmail(rawEmail);
  if (!looksLikeEmail(email)) throw new AuthError("Please enter a valid email address.");
  if (!allowedEmails().includes(email)) return { email, code: null };

  const existing = await readJson(pathFor("codes", email));
  if (existing && Date.now() - existing.sentAt < CODE_RESEND_SECONDS * 1000) {
    throw new AuthError("A code was just sent. Please wait a minute before requesting another.", 429);
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await writeJson(pathFor("codes", email), {
    hash: hashCode(email, code),
    sentAt: Date.now(),
    expiresAt: Date.now() + CODE_MINUTES * 60e3,
    attempts: 0,
  });
  return { email, code, minutes: CODE_MINUTES };
}

// Removes a pending code (e.g. when its email failed to send).
export async function clearCode(email) {
  await del(pathFor("codes", normalizeEmail(email))).catch(() => {});
}

// Creates the account, or resets its password if it already exists.
export async function setPasswordWithCode(rawEmail, rawCode, password) {
  assertConfigured();
  const email = normalizeEmail(rawEmail);
  const code = String(rawCode || "").replace(/\D/g, "");
  checkPasswordRules(password);
  if (!allowedEmails().includes(email)) throw new AuthError("That code is incorrect or has expired.");

  const codePath = pathFor("codes", email);
  const record = await readJson(codePath);
  if (!record || record.expiresAt < Date.now()) {
    throw new AuthError("That code has expired. Please request a new one.");
  }
  if (record.attempts >= MAX_CODE_ATTEMPTS) {
    await del(codePath);
    throw new AuthError("Too many incorrect tries. Please request a new code.");
  }
  const expected = Buffer.from(record.hash);
  const given = Buffer.from(hashCode(email, code));
  if (code.length !== 6 || !timingSafeEqual(expected, given)) {
    await writeJson(codePath, { ...record, attempts: record.attempts + 1 });
    throw new AuthError("That code is incorrect.");
  }

  const existing = await getAccount(email);
  const account = {
    email,
    passwordHash: await hashPassword(password),
    sessionVersion: randomBytes(12).toString("base64url"), // signs out any old sessions
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
    failedLogins: 0,
    lockedUntil: 0,
  };
  await saveAccount(account);
  await del(codePath);
  return { ...createSession(account), created: !existing };
}

export async function login(rawEmail, password) {
  assertConfigured();
  const email = normalizeEmail(rawEmail);
  const account = looksLikeEmail(email) && allowedEmails().includes(email) ? await getAccount(email) : null;

  if (!account) {
    await hashPassword(String(password || "x")); // same work as a real check, so timing reveals nothing
    throw new AuthError("Incorrect email or password.", 401);
  }
  if (account.lockedUntil > Date.now()) {
    const minutes = Math.ceil((account.lockedUntil - Date.now()) / 60e3);
    throw new AuthError(`Too many failed sign-ins. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or reset your password.`, 429);
  }
  if (!(await verifyPassword(String(password || ""), account.passwordHash))) {
    const failedLogins = (account.failedLogins || 0) + 1;
    const locked = failedLogins >= MAX_LOGIN_FAILURES;
    await saveAccount({
      ...account,
      failedLogins: locked ? 0 : failedLogins,
      lockedUntil: locked ? Date.now() + LOCK_MINUTES * 60e3 : 0,
    });
    throw new AuthError("Incorrect email or password.", 401);
  }
  if (account.failedLogins || account.lockedUntil) {
    await saveAccount({ ...account, failedLogins: 0, lockedUntil: 0 });
  }
  return createSession(account);
}
