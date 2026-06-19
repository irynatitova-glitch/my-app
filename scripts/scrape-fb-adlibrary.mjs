// Headless Meta Ad Library scraper.
// Loads the official Meta Ad Library (facebook.com/ads/library) in a real
// browser and extracts recent ad creatives for a search query. The public Ad
// Library website shows commercial advertisers' active ads with no login.
//
// NOTE: Meta's official Ad Library *API* (ads_archive) only returns
// social-issue/electoral/political ads for keyword search outside the EU, so it
// will NOT return BIGO's commercial UA creatives. The public Ad Library
// *website* does — which is why this scrapes the rendered page (same approach
// as scrape-appstore.mjs).
//
// Usage:
//   node scripts/scrape-fb-adlibrary.mjs "<query>" [--limit=3] [--explore] [--competitorId=<id>]
//   --explore : print results, do NOT write to the DB.

import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import "dotenv/config";

const query = process.argv[2] || "bigo live";
const explore = process.argv.includes("--explore");
const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] || 3);
const forcedId = process.argv.find((a) => a.startsWith("--competitorId="))?.split("=")[1];

const url =
  "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL" +
  "&is_targeted_country=false&media_type=all&q=" +
  encodeURIComponent(query) +
  "&search_type=keyword_unordered&sort_data[direction]=desc&sort_data[mode]=total_impressions";

// ---- 1. Render the page ----
const browser = await chromium.launch();
const page = await browser.newPage({
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  viewport: { width: 1440, height: 1600 },
  locale: "en-US",
});
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

// Dismiss cookie consent if present.
for (const label of ["Allow all cookies", "Only allow essential cookies", "Decline optional cookies"]) {
  const btn = page.getByRole("button", { name: label }).first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click().catch(() => {});
    break;
  }
}

// Wait for results to populate, then let lazy content settle.
await page.waitForFunction(() => /Library ID:/.test(document.body.innerText), { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(3000);

// Scroll deep enough to load a candidate pool, so we can sort by start date
// ourselves (the Ad Library URL has no date-sort mode). Lazy media loads as we go.
for (let y = 0; y < 14; y++) {
  await page.mouse.wheel(0, 1100);
  await page.waitForTimeout(650);
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1500);

// ---- 2. Extract ad cards (collect a pool, sort by date below) ----
const pool = await page.evaluate((max) => {
  const text = (el) => (el.innerText || "").replace(/[\u00a0\u200b\u200e\u200f]/g, " ").replace(/[ \t]+/g, " ").trim();

  const idCount = (el) => (text(el).match(/Library ID:/g) || []).length;

  // Find each "Library ID:" marker and climb to the FULL card container: the
  // largest ancestor that still holds exactly ONE "Library ID:" (going up one
  // more would merge sibling cards under the results grid). FB's classes are
  // obfuscated, so we anchor on stable visible text instead.
  const markers = [...document.querySelectorAll("span, div")].filter(
    (el) => /^Library ID:\s*\d+/.test(text(el)) && el.children.length <= 1
  );

  const seen = new Set();
  const cards = [];
  for (const marker of markers) {
    let card = marker;
    while (card.parentElement && idCount(card.parentElement) === 1) card = card.parentElement;
    const body = text(card);
    const idMatch = body.match(/Library ID:\s*(\d+)/);
    if (!idMatch || seen.has(idMatch[1])) continue;
    seen.add(idMatch[1]);

    const libraryId = idMatch[1];
    const started = (body.match(/Started running on ([^\n·]+)/) || [])[1]?.trim() || null;
    const platforms = (body.match(/Platforms?\s*([^\n]+)/) || [])[1]?.trim() || null;

    // Creative media. Keep fbcdn/scontent assets that are either rendered big
    // (>=120px) or not-yet-sized (lazy, w==0); drop small profile/icon thumbs
    // (their URLs carry sNNxNN / pNNxNN / cp0 crops well under 120px).
    const isProfileThumb = (u) => /\/[sp]\d{1,3}x\d{1,3}\//.test(u) || /\bs(40|48|60)x/.test(u);
    const imgs = [...card.querySelectorAll("img")]
      .map((im) => ({ src: im.src, w: im.naturalWidth || im.width || 0, h: im.naturalHeight || im.height || 0 }))
      .filter((im) => im.src && /fbcdn|scontent/.test(im.src) && !isProfileThumb(im.src))
      .filter((im) => im.w === 0 || (im.w >= 120 && im.h >= 120))
      .map((im) => im.src);
    // Video poster frames are the usable still for video creatives (the <video>
    // src itself is a transient blob: URL that won't resolve outside the page).
    const posters = [...card.querySelectorAll("video[poster]")].map((v) => v.poster).filter(Boolean);
    const images = [...new Set([...imgs, ...posters])];
    const videos = [...card.querySelectorAll("video")]
      .map((v) => v.src || v.querySelector("source")?.src)
      .filter((s) => s && !s.startsWith("blob:"));

    // Ad copy = card text minus the metadata chrome lines.
    const copy = body
      .split("\n")
      .filter(
        (l) =>
          l.trim() &&
          !/^Library ID:/.test(l) &&
          !/^Started running/.test(l) &&
          !/^Sponsored$/.test(l) &&
          !/^Platforms?/.test(l) &&
          !/^(Active|Inactive)$/.test(l) &&
          !/^See (ad |summary )?details/i.test(l) &&
          !/This ad has multiple versions/i.test(l) &&
          !/^\d+ ads? use this creative and text$/i.test(l) &&
          !/^\d+:\d+\s*\/\s*\d+:\d+$/.test(l) &&
          !/^Open Dropdown$/.test(l)
      )
      .join("\n")
      .trim();

    cards.push({ libraryId, started, platforms, copy, images, videos: [...new Set(videos)] });
    if (cards.length >= max) break;
  }
  return cards;
}, 60);

await browser.close();

// Sort newest → oldest by "Started running on <date>", then keep the top `limit`.
const ts = (s) => {
  const t = s ? Date.parse(s) : NaN;
  return isNaN(t) ? -Infinity : t;
};
const sorted = pool.sort((a, b) => ts(b.started) - ts(a.started));

// Dedupe near-identical variants (same ad copy, different video cut / ID) so we
// surface distinct creatives. Keep the newest instance of each copy.
// Key on the primary text line (longest non-URL/CTA line) — stable across the
// ID/video-cut/"summary card" variants that share one creative concept.
const dedupKey = (ad) => {
  const lines = (ad.copy || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const primary = lines
    .filter((l) => !/^[A-Z0-9.]+\.(COM|NET|ORG)$/i.test(l) && !/^(Install now|Download|Learn more|Sign up|Shop now)$/i.test(l))
    .sort((a, b) => b.length - a.length)[0];
  return (primary || ad.libraryId).replace(/\s+/g, " ").trim().toLowerCase();
};
const byCopy = new Map();
for (const ad of sorted) {
  const key = dedupKey(ad);
  if (!byCopy.has(key)) byCopy.set(key, ad);
}
const ads = [...byCopy.values()].slice(0, limit);

console.log(`Query: "${query}"  —  pool ${pool.length}, ${byCopy.size} distinct, showing newest ${ads.length}\n`);
ads.forEach((ad, i) => {
  console.log(`#${i + 1}  Library ID ${ad.libraryId}`);
  console.log(`    started:   ${ad.started || "?"}`);
  console.log(`    platforms: ${ad.platforms || "?"}`);
  console.log(`    images:    ${ad.images.length}  videos: ${ad.videos.length}`);
  console.log(`    copy:      ${ad.copy ? ad.copy.replace(/\n/g, "\n               ").slice(0, 400) : "(none)"}`);
  if (ad.images[0]) console.log(`    image[0]:  ${ad.images[0]}`);
  console.log();
});

if (explore) {
  console.log("[--explore: nothing written to DB]");
  process.exit(0);
}
if (ads.length === 0) {
  console.error("No ads extracted — aborting DB write.");
  process.exit(2);
}

// ---- 3. Write to DB as UA_CREATIVE updates ----
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

let competitorId = forcedId;
if (!competitorId) {
  const c = await prisma.competitor.findFirst({ where: { name: { contains: "Bigo", mode: "insensitive" } } });
  competitorId = c?.id;
}
if (!competitorId) {
  console.error("No competitor matched. Pass --competitorId=<id>.");
  await prisma.$disconnect();
  process.exit(3);
}

let created = 0;
for (const ad of ads) {
  const title = `UA creative — Library ID ${ad.libraryId}`;
  const existing = await prisma.update.findFirst({
    where: { competitorId, type: "UA_CREATIVE", title },
  });
  if (existing) {
    console.log(`skip (exists): ${title}`);
    continue;
  }
  const occurredAt = ad.started ? new Date(ad.started) : new Date();
  await prisma.update.create({
    data: {
      competitorId,
      type: "UA_CREATIVE",
      title,
      description: ad.copy || null,
      sourceUrl: `https://www.facebook.com/ads/library/?id=${ad.libraryId}`,
      imageUrl: ad.images[0] || null,
      screenshots: ad.images,
      occurredAt: isNaN(occurredAt) ? new Date() : occurredAt,
    },
  });
  created++;
  console.log(`created: ${title}`);
}
console.log(`\n✓ ${created} UA_CREATIVE update(s) created for competitor ${competitorId}`);
await prisma.$disconnect();
