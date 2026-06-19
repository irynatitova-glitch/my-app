import prisma from "../../../lib/prisma";
import { requireApiAuth } from "../../../lib/auth";

export default async function handler(req, res) {
  if (!(await requireApiAuth(req, res))) return;

  if (req.method === "POST") {
    const { competitorId, type, title, description, sourceUrl, occurredAt } = req.body;
    if (!competitorId || !type || !title)
      return res.status(400).json({ error: "competitorId, type, title required" });

    const update = await prisma.update.create({
      data: {
        competitorId,
        type,
        title,
        description,
        sourceUrl,
        occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      },
    });
    return res.status(201).json(update);
  }

  res.status(405).end();
}
