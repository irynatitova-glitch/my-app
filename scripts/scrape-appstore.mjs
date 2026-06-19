// Headless App Store scraper.
// Loads an app's App Store page in a real browser and extracts the current
// version's screenshots from the rendered DOM. (Apple's web page only ships
// the *current* version's data — historical version notes are not present in
// the markup, so they cannot be scraped here.)
//
// Usage:
//   node scripts/scrape-appstore.mjs <appStoreUrl> [--explore]
//   --explore : print results, do NOT write to the DB.
//
// When writing, screenshots are attached to the competitor's most recent
// APP_STORE update (matched by appStoreUrl). Pass --competitorId=<id> to force.

import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import "dotenv/config";

const url = process.argv[2];
const explore = process.argv.includes("--explore");
const forcedId = process.argv.find((a) => a.startsWith("--competitorId="))?.split("=")[1];
if (!url) {
  console.error("Usage: node scripts/scrape-appstore.mjs <appStoreUrl> [--explore] [--competitorId=<id>]");
  process.exit(1);
}

// ---- 1. Scrape screenshots from the rendered page ----
const browser = await chromium.launch();
const page = await browser.newPage({
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  viewport: { width: 1440, height: 1200 },
});
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);

const raw = await page.evaluate(() => {
  const urls = new Set();
  document.querySelectorAll("picture source[srcset], picture img[src], img[srcset]").forEach((el) => {
    const ss = el.getAttribute("srcset") || el.getAttribute("src") || "";
    ss.split(",").forEach((part) => {
      const u = part.trim().split(" ")[0];
      if (u && u.includes("mzstatic.com/image") && /IOS|Unite|Source/.test(u) && !/Placeholder|AppIcon/i.test(u)) {
        urls.add(u);
      }
    });
  });
  return [...urls];
});
const currentVersion = await page.evaluate(() => {
  const m = (document.body.innerText.match(/\b\d+\.\d+(?:\.\d+)?\b/g) || [])[0];
  return m || null;
});
await browser.close();

// Dedupe by base asset (path before the /{dims}.{fmt} suffix), keep a high-res webp.
const byAsset = new Map();
for (const u of raw) {
  const base = u.replace(/\/\d+x\d+[a-z]*(?:-\d+)?\.(webp|jpg|png)$/i, "");
  if (!byAsset.has(base)) byAsset.set(base, `${base}/460x996bb.webp`);
}
const screenshots = [...byAsset.values()];

console.log(`Current version on page: ${currentVersion}`);
console.log(`Distinct screenshots: ${screenshots.length}`);
screenshots.forEach((u, i) => console.log(`  ${i + 1}. ${u}`));

if (explore) {
  console.log("\n[--explore: nothing written to DB]");
  process.exit(0);
}
if (screenshots.length === 0) {
  console.error("No screenshots found — aborting DB write.");
  process.exit(2);
}

// ---- 2. Write to DB ----
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

let competitorId = forcedId;
if (!competitorId) {
  const c = await prisma.competitor.findFirst({ where: { appStoreUrl: url } });
  competitorId = c?.id;
}
if (!competitorId) {
  console.error(`No competitor matched appStoreUrl=${url}. Pass --competitorId=<id>.`);
  await prisma.$disconnect();
  process.exit(3);
}

// Attach to the most recent APP_STORE update, else create one.
let update = await prisma.update.findFirst({
  where: { competitorId, type: "APP_STORE" },
  orderBy: { occurredAt: "desc" },
});
if (update) {
  update = await prisma.update.update({
    where: { id: update.id },
    data: { screenshots, imageUrl: screenshots[0] },
  });
  console.log(`\n✓ Attached ${screenshots.length} screenshots to update "${update.title}" (${update.id})`);
} else {
  update = await prisma.update.create({
    data: {
      competitorId,
      type: "APP_STORE",
      title: currentVersion ? `App Store screenshots (v${currentVersion})` : "App Store screenshots",
      sourceUrl: url,
      screenshots,
      imageUrl: screenshots[0],
    },
  });
  console.log(`\n✓ Created APP_STORE update with ${screenshots.length} screenshots (${update.id})`);
}

await prisma.$disconnect();
