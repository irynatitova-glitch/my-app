import { SESSION_COOKIE, destroySession, clearCookie } from "../../../lib/auth";

export default async function handler(req, res) {
  // Revoke the session server-side, then clear the cookie.
  await destroySession(req.cookies?.[SESSION_COOKIE]);
  res.setHeader("Set-Cookie", clearCookie());

  // Support both a plain link (GET) and a fetch call.
  if (req.method === "GET") {
    return res.redirect(302, "/login");
  }
  return res.status(200).json({ ok: true });
}
