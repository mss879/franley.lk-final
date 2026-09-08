import sharp from "sharp";

/**
 * A curated menswear palette. Sampled colours snap to the nearest entry, which
 * gives names a customer recognises ("Navy", "Burgundy") instead of the raw
 * hex a naive extractor would produce.
 */
export const PALETTE = [
  ["Black", "#1A1A1A"], ["Charcoal", "#3A3D42"], ["Graphite", "#4E5257"],
  ["Silver", "#B8BDC2"], ["Pewter", "#8A8F94"], ["Ivory", "#F0EBE2"],
  ["Navy", "#1B2A4A"], ["Midnight Blue", "#16233D"], ["Royal Blue", "#22439B"],
  ["Cobalt", "#2F5FCB"], ["Sky Blue", "#7FA8D9"], ["Teal", "#2E6E76"],
  ["Aqua", "#4FB3BF"], ["Burgundy", "#711625"], ["Wine", "#5C1220"],
  ["Crimson", "#9B1B22"], ["Brick", "#B3402F"], ["Rose", "#D9808F"],
  ["Blush Pink", "#E8A0B4"], ["Magenta", "#B02A6B"], ["Purple", "#6B4E9E"],
  ["Lavender", "#A98FC9"], ["Plum", "#5E3A5E"], ["Forest Green", "#2F5D3F"],
  ["Olive", "#6B6B3A"], ["Emerald", "#1F7A5A"], ["Gold", "#C9A961"],
  ["Mustard", "#D3A72B"], ["Amber", "#E0A33C"], ["Bronze", "#8C6239"],
  ["Chocolate", "#5A3A28"], ["Camel", "#C2A07A"], ["Beige", "#D9C7A8"],
  ["Coral", "#E07B5A"], ["Orange", "#E07B39"],
];

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const PAL = PALETTE.map(([name, hex]) => ({ name, hex, rgb: hexToRgb(hex) }));

/** Perceptual-ish distance: weights green most, as the eye does. */
function dist([r1, g1, b1], [r2, g2, b2]) {
  const rm = (r1 + r2) / 2;
  return Math.sqrt(
    (2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2,
  );
}

export function nearestColour(rgb) {
  let best = PAL[0], bestD = Infinity;
  for (const p of PAL) {
    const d = dist(rgb, p.rgb);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

/**
 * The two most-covering colours of the product itself. The shot is on white
 * with a soft shadow, so near-white and near-neutral-grey pixels are discarded
 * before counting.
 */
export async function dominantColours(file, topN = 2) {
  const { data, info } = await sharp(file)
    .flatten({ background: "#ffffff" })
    .resize(160, 160, { fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const buckets = new Map();
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max > 232) continue;                 // paper white
    if (max - min < 12 && max > 200) continue; // shadow on white
    const key = `${r >> 4},${g >> 4},${b >> 4}`;
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += r; e.g += g; e.b += b;
    buckets.set(key, e);
  }

  const ranked = [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .map((e) => ({ n: e.n, rgb: [e.r / e.n, e.g / e.n, e.b / e.n].map(Math.round) }));

  const out = [];
  for (const c of ranked) {
    const named = nearestColour(c.rgb);
    // Keep only colours that are visually distinct from the ones already taken.
    if (out.some((o) => dist(o.rgb, c.rgb) < 90)) continue;
    out.push({ ...named, rgb: c.rgb, share: c.n });
    if (out.length === topN) break;
  }
  return out;
}
