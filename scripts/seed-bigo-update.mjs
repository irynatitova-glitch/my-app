import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const APP_STORE_URL =
  "https://apps.apple.com/ua/app/bigo-live-live-stream-go-live/id1077137248";

// Pulled from the App Store (iTunes lookup API, country=ua)
const VERSION = "6.49.1";
const RELEASE_DATE = "2026-06-09T02:11:41Z";
const RELEASE_NOTES = "The lastest version contains bug fixes and performance improvements";

const competitors = await prisma.competitor.findMany({
  select: { id: true, name: true, appStoreUrl: true },
});
console.log("Existing competitors:", JSON.stringify(competitors, null, 2));

let competitor =
  competitors.find((c) => /bigo/i.test(c.name)) ||
  competitors.find((c) => c.appStoreUrl?.includes("id1077137248"));

if (!competitor) {
  competitor = await prisma.competitor.create({
    data: {
      name: "BIGO LIVE",
      appStoreUrl: APP_STORE_URL,
      category: "Live Streaming",
    },
  });
  console.log("Created competitor:", competitor.id);
} else {
  console.log("Found competitor:", competitor.id, competitor.name);
  if (!competitor.appStoreUrl) {
    await prisma.competitor.update({
      where: { id: competitor.id },
      data: { appStoreUrl: APP_STORE_URL },
    });
  }
}

const title = `App Store update — v${VERSION}`;

// Avoid duplicating the same version update if re-run.
const existing = await prisma.update.findFirst({
  where: { competitorId: competitor.id, type: "APP_STORE", title },
});
if (existing) {
  console.log("Update already exists:", existing.id);
} else {
  const update = await prisma.update.create({
    data: {
      competitorId: competitor.id,
      type: "APP_STORE",
      title,
      description: RELEASE_NOTES,
      sourceUrl: APP_STORE_URL,
      occurredAt: new Date(RELEASE_DATE),
    },
  });
  console.log("Created update:", JSON.stringify(update, null, 2));
}

await prisma.$disconnect();
