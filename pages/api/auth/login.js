import prisma from "../../../lib/prisma";
import {
  verifyPassword,
  createSession,
  sessionCookie,
  isValidEmail,
  normalizeEmail,
} from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { email, password } = req.body ?? {};
  if (!isValidEmail(email) || typeof password !== "string" || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  // Same generic message whether the email is unknown or the password is wrong.
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = await createSession(user.id);
  res.setHeader("Set-Cookie", sessionCookie(token));
  return res.status(200).json({ email: user.email });
}
