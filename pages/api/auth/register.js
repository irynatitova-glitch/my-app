import prisma from "../../../lib/prisma";
import {
  hashPassword,
  createSession,
  sessionCookie,
  isValidEmail,
  normalizeEmail,
} from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { email, password } = req.body ?? {};

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Enter a valid email address" });
  }
  if (typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const normalized = normalizeEmail(email);
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const user = await prisma.user.create({
    data: { email: normalized, passwordHash: hashPassword(password) },
  });

  const token = await createSession(user.id);
  res.setHeader("Set-Cookie", sessionCookie(token));
  return res.status(201).json({ email: user.email });
}
