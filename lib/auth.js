// Real, database-backed authentication.
//
// - Passwords are hashed with scrypt (node:crypto) — no external dependency.
// - Sessions live in the `sessions` table; the cookie holds an opaque random
//   token, not the email. Logout deletes the session row, so it is revoked
//   server-side, not just client-side.

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import prisma from "./prisma";

export const SESSION_COOKIE = "ci_session";

const WEEK_SECONDS = 60 * 60 * 24 * 7;
const SCRYPT_KEYLEN = 64;

// ----- password hashing -------------------------------------------------

// Returns a "salt:hash" string safe to store in the DB.
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${derived}`;
}

// Constant-time comparison of a plaintext password against a stored hash.
export function verifyPassword(password, stored) {
  if (typeof stored !== "string" || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const hashBuf = Buffer.from(hash, "hex");
  const testBuf = scryptSync(password, salt, SCRYPT_KEYLEN);
  return hashBuf.length === testBuf.length && timingSafeEqual(hashBuf, testBuf);
}

// ----- session management ----------------------------------------------

// Creates a session row for a user and returns the opaque token.
export async function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + WEEK_SECONDS * 1000);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  return token;
}

// Resolves the current request's user from its session cookie, or null.
// Expired sessions are deleted as they are encountered.
export async function getSessionUser(req) {
  const token = req?.cookies?.[SESSION_COOKIE];
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { token } }).catch(() => {});
    return null;
  }
  return session.user;
}

// Deletes a session by token (used on logout). Safe if the token is missing.
export async function destroySession(token) {
  if (!token) return;
  await prisma.session.deleteMany({ where: { token } });
}

// ----- cookie helpers ---------------------------------------------------

export function sessionCookie(token) {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${WEEK_SECONDS}`;
}

export function clearCookie() {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=0`;
}

// ----- guards -----------------------------------------------------------

// Page guard for getServerSideProps. Returns { redirect } when logged out,
// or { user } when authenticated.
export async function requireAuth(context) {
  const user = await getSessionUser(context.req);
  if (!user) {
    return { redirect: { destination: "/login", permanent: false } };
  }
  return { user };
}

// API-route guard. Responds 401 and returns null when logged out, otherwise
// returns the authenticated user.
export async function requireApiAuth(req, res) {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return user;
}

// ----- validation -------------------------------------------------------

export function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}
