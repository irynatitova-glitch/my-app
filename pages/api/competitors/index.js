import prisma from "../../../lib/prisma";
import { requireApiAuth } from "../../../lib/auth";

export default async function handler(req, res) {
  if (!(await requireApiAuth(req, res))) return;

  if (req.method === "GET") {
    const competitors = await prisma.competitor.findMany({
      include: { updates: { orderBy: { occurredAt: "desc" }, take: 1 } },
      orderBy: { name: "asc" },
    });
    return res.json(competitors);
  }

  if (req.method === "POST") {
    const { name, appStoreUrl, category, logoUrl } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    const competitor = await prisma.competitor.create({
      data: { name, appStoreUrl, category, logoUrl },
    });
    return res.status(201).json(competitor);
  }

  res.status(405).end();
}
