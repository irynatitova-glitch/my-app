import Anthropic from "@anthropic-ai/sdk";
import prisma from "../../lib/prisma";
import { requireApiAuth } from "../../lib/auth";

const client = new Anthropic();

export default async function handler(req, res) {
  if (!(await requireApiAuth(req, res))) return;
  if (req.method !== "POST") return res.status(405).end();

  const { text, updateId } = req.body;
  if (!text || !updateId) return res.status(400).json({ error: "text and updateId required" });

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are a product intelligence analyst for Aveola, a [describe your app] app.

Analyze this competitor App Store content and extract structured insights:

---
${text}
---

Reply ONLY with valid JSON in this exact shape:
{
  "monetizationModel": "one sentence describing their monetization (subscription, freemium, one-time, ads, etc.)",
  "keyHooks": ["hook 1", "hook 2", "hook 3"],
  "targetPersona": "one sentence describing their target user",
  "aveolaTips": ["specific thing Aveola could test or adopt", "another tip", "another tip"]
}`,
      },
    ],
  });

  let parsed;
  try {
    const raw = message.content[0].text.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    return res.status(422).json({ error: "Claude returned unparseable JSON", raw: message.content[0].text });
  }

  const insight = await prisma.insight.upsert({
    where: { updateId },
    update: {
      monetizationModel: parsed.monetizationModel,
      keyHooks: parsed.keyHooks ?? [],
      targetPersona: parsed.targetPersona,
      aveolaTips: parsed.aveolaTips ?? [],
      rawInput: text,
    },
    create: {
      updateId,
      monetizationModel: parsed.monetizationModel,
      keyHooks: parsed.keyHooks ?? [],
      targetPersona: parsed.targetPersona,
      aveolaTips: parsed.aveolaTips ?? [],
      rawInput: text,
    },
  });

  res.json(insight);
}
