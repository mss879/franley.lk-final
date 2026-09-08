import fs from "node:fs";
import crypto from "node:crypto";
import sharp from "sharp";
import { dominantColours } from "./colour-names.mjs";

const RAW = "/tmp/rawimg";           // downloaded Shopify originals
const OUT = "public/products";       // optimised webp the site serves

const raw = JSON.parse(fs.readFileSync("data/shopify-products.json", "utf8"));

/**
 * The four cufflink listings share a title on Shopify but are four different
 * designs. Named here from the face pattern in each photograph.
 */
const CUFFLINK_DESIGNS = {
  "franley-silver-tone-cufflinks-textured-square": "Half-Grid",
  "franley-silver-tone-cufflinks-textured-square-1": "Bevelled Frame",
  "franley-silver-tone-cufflinks-textured-square-2": "Diamond Lattice",
  "franley-silver-tone-cufflinks-textured-square-3": "Engine-Turned",
};

const stripHtml = (h) => (h || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const localName = (handle, position) => `${handle}-${position}.jpg`;

/** 16x16 greyscale fingerprint — catches the same photo re-uploaded under a new name. */
async function imageHash(file) {
  const buf = await sharp(file).flatten({ background: "#fff" })
    .greyscale().resize(16, 16, { fit: "fill" }).raw().toBuffer();
  return crypto.createHash("md5").update(buf).digest("hex");
}

function patternOf(p, title) {
  if (/cufflink/i.test(title)) return null;
  if (/two-tone/i.test(p.title)) return "Two-Tone";
  if (p.product_type === "Stripes" || /stripe/i.test(p.title)) return "Stripe";
  return "Plain";
}

const products = [];
const seenPrimary = new Map();

for (const p of raw) {
  const primary = p.images[0];
  if (!primary) continue;

  const primaryFile = `${RAW}/${localName(p.handle, primary.position)}`;
  if (!fs.existsSync(primaryFile)) continue;

  // Drop only genuine duplicate LISTINGS — the same photograph twice. Products
  // that merely share a colour name are distinct designs and all stay.
  const hash = await imageHash(primaryFile);
  if (seenPrimary.has(hash)) continue;
  seenPrimary.set(hash, p.handle);

  const isCufflink = /cufflink/i.test(p.title);
  const pattern = patternOf(p, p.title);
  const colours = isCufflink ? [] : await dominantColours(primaryFile, 2);

  let title;
  if (isCufflink) {
    const design = CUFFLINK_DESIGNS[p.handle] ?? "Textured Square";
    title = `Silver ${design} Cufflink & Tie Clip Set`;
  } else if (pattern !== "Plain") {
    // Only pair the two shades when they resolve to different names —
    // "Royal Blue & Royal Blue" helps nobody.
    const pair = colours.length > 1 && colours[0].name !== colours[1].name
      ? `${colours[0].name} & ${colours[1].name}`
      : (colours[0]?.name ?? "Classic");
    title = `${pair} ${pattern === "Two-Tone" ? "Two-Tone" : "Stripe"} Tie`;
  } else {
    title = `${colours[0]?.name ?? "Classic"} Silk-Finish Tie`;
  }

  const size = p.options.find((o) => o.name === "Size")?.values?.[0] ?? null;
  const widthCm = size ? (size.match(/([\d.]+)\s*cm/)?.[1] ?? null) : null;

  const existing = stripHtml(p.body_html);
  const description = existing.length > 60
    ? existing
    : isCufflink
      ? "A matching cufflink and tie clip set in premium silver-tone alloy, presented in a lined FRANLEY gift box. The clip holds a blade up to 6cm without marking the silk."
      : `A ${pattern === "Plain" ? "fine twill" : "woven diagonal"} necktie cut to a modern ${widthCm ?? "6"}cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.`;

  const images = [];
  for (const im of p.images) {
    const src = `${RAW}/${localName(p.handle, im.position)}`;
    if (fs.existsSync(src)) images.push({ src, out: `${p.handle}-${im.position}.webp` });
  }
  if (!images.length) continue;

  products.push({
    slug: p.handle,
    title,
    description,
    price_cents: Math.round(parseFloat(p.variants[0].price) * 100),
    compare_at_cents: p.variants[0].compare_at_price
      ? Math.round(parseFloat(p.variants[0].compare_at_price) * 100) : null,
    category: isCufflink ? "cufflinks" : pattern === "Plain" ? "plain-ties" : "striped-ties",
    color_name: colours[0]?.name ?? null,
    color_hex: colours[0] ? "#" + colours[0].rgb.map((v) => v.toString(16).padStart(2, "0")).join("") : null,
    width_cm: widthCm,
    images: images.map((i) => `/products/${i.out}`),
    _files: images,
    featured: false,
    stock: 25,
  });
}

// Two products can still land on the same name (two navies, say). Disambiguate
// with the secondary colour rather than a meaningless number where possible.
const byTitle = new Map();
for (const p of products) byTitle.set(p.title, (byTitle.get(p.title) ?? 0) + 1);
const ROMAN = ["", "", "II", "III", "IV", "V", "VI", "VII"];
const used = new Map();
for (const p of products) {
  if (byTitle.get(p.title) === 1) continue;
  const n = (used.get(p.title) ?? 0) + 1;
  used.set(p.title, n);
  // The first of a repeated name keeps it clean; later ones become variants.
  if (n > 1) p.title = `${p.title} ${ROMAN[n] ?? n}`;
}

// Convert the images the surviving products actually reference.
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const p of products) {
  for (const f of p._files) {
    await sharp(f.src).flatten({ background: "#ffffff" })
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 }).toFile(`${OUT}/${f.out}`);
  }
  delete p._files;
}

// Feature a spread across all three categories for the homepage.
for (const cat of ["striped-ties", "plain-ties", "cufflinks"]) {
  products.filter((p) => p.category === cat).slice(0, 3).forEach((p) => (p.featured = true));
}

const categories = [
  { slug: "neckties", name: "Neckties", description: "Woven silk-finish neckties in a modern blade width.", position: 1, parent: null },
  { slug: "plain-ties", name: "Plain", description: "Solid, fine-twill neckties for everyday tailoring.", position: 2, parent: "neckties" },
  { slug: "striped-ties", name: "Stripes", description: "Diagonal repp stripes with a classic city finish.", position: 3, parent: "neckties" },
  { slug: "cufflinks", name: "Cufflinks", description: "Cufflink and tie clip sets in premium alloy, gift boxed.", position: 4, parent: null },
];

fs.writeFileSync("data/seed.json", JSON.stringify({ categories, products }, null, 2));

const byCat = {};
products.forEach((p) => (byCat[p.category] = (byCat[p.category] || 0) + 1));
console.log(`products: ${products.length} (from ${raw.length} listings)`);
console.log("by category:", byCat);
console.log("images written:", fs.readdirSync(OUT).length);
console.log("\ntitles:");
products.forEach((p, i) => console.log(`  ${String(i + 1).padStart(2)}. ${p.title}`));
