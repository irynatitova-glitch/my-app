import prisma from "../../../lib/prisma";
import { requireApiAuth } from "../../../lib/auth";

export default async function handler(req, res) {
  if (!(await requireApiAuth(req, res))) return;

  const { id } = req.query;

  if (req.method === "GET") {
    const competitor = await prisma.competitor.findUnique({
      where: { id },
      include: {
        updates: {
          orderBy: { occurredAt: "desc" },
          include: { insight: true },
        },
      },
    });
    if (!competitor) return res.status(404).json({ error: "Not found" });
    return res.json(competitor);
  }

  if (req.method === "DELETE") {
    await prisma.competitor.delete({ where: { id } });
    return res.status(204).end();
  }

  res.status(405).end();
}
