import prisma from "../../../lib/prisma";
import { requireApiAuth } from "../../../lib/auth";

export default async function handler(req, res) {
  if (!(await requireApiAuth(req, res))) return;

  const { id } = req.query;

  if (req.method === "DELETE") {
    await prisma.update.delete({ where: { id } });
    return res.status(204).end();
  }

  res.status(405).end();
}
