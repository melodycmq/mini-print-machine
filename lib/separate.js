import sharp from "sharp";

// Turns one generated print into what the page needs to "pull" it like a real multi-ink print:
//   - one transparent PNG per ink (the color separations), ordered lightest → darkest,
//   - a flat composite of all inks (for the stash and instant viewing),
//   - a tight thumbnail trimmed to the drawing (for the machine's six stickers, so nothing is cropped).
// Every inked pixel is snapped to the nearest of the print's 3–4 inks, so each layer is one solid color.
// If the model painted a paper/background anyway, it's detected from the border and knocked out.

const WIDTH = 720;             // plenty for a card shown at ≤ 320 CSS px on a 2× screen
const MIN_ALPHA = 24;          // below this a pixel counts as empty
const BG_TOLERANCE = 42;       // RGB distance from the detected background still treated as background
const MIN_LAYER_SHARE = 0.004; // drop an ink that covers < 0.4% of the drawing (stray specks)

const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const dist2 = (a, r, g, b) => (a[0] - r) ** 2 + (a[1] - g) ** 2 + (a[2] - b) ** 2;

// If most of the border is opaque, the model drew a background: estimate its color from the border.
function detectBackground(data, w, h) {
  const px = [];
  const take = (x, y) => { const i = (y * w + x) * 4; if (data[i + 3] > 200) px.push([data[i], data[i + 1], data[i + 2]]); };
  for (let x = 0; x < w; x += 4) { take(x, 0); take(x, h - 1); }
  for (let y = 0; y < h; y += 4) { take(0, y); take(w - 1, y); }
  const total = Math.ceil(w / 4) * 2 + Math.ceil(h / 4) * 2;
  if (px.length < total * 0.6) return null;
  const mid = (k) => px.map((p) => p[k]).sort((a, b) => a - b)[px.length >> 1];
  return [mid(0), mid(1), mid(2)];
}

export async function separate(png, inkHexes) {
  const { data, info } = await sharp(png).resize({ width: WIDTH }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const inks = inkHexes.map((hex) => ({ hex, rgb: hexToRgb(hex) })).sort((a, b) => luminance(b.rgb) - luminance(a.rgb));
  const bg = detectBackground(data, w, h);
  const bgTol2 = BG_TOLERANCE ** 2;

  const layers = inks.map(() => Buffer.alloc(w * h * 4));
  const counts = inks.map(() => 0);
  const owner = new Int8Array(w * h).fill(-1);
  let minX = w, minY = h, maxX = -1, maxY = -1, inked = 0;

  for (let p = 0; p < w * h; p++) {
    const i = p * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    let a = data[i + 3];
    if (bg && dist2(bg, r, g, b) < bgTol2) a = 0;
    // Near-white inside the drawing is the paper showing through (highlights, carved lines), not an ink.
    if (r > 232 && g > 232 && b > 232) a = 0;
    if (a < MIN_ALPHA) continue;
    let best = 0, bestD = Infinity;
    for (let k = 0; k < inks.length; k++) {
      const d = dist2(inks[k].rgb, r, g, b);
      if (d < bestD) { bestD = d; best = k; }
    }
    const [ir, ig, ib] = inks[best].rgb, L = layers[best];
    L[i] = ir; L[i + 1] = ig; L[i + 2] = ib; L[i + 3] = a;
    owner[p] = best; counts[best]++; inked++;
    const x = p % w, y = (p / w) | 0;
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (!inked) throw new Error("separation found no ink");

  const keep = inks.map((_, k) => counts[k] / inked >= MIN_LAYER_SHARE);
  const composite = Buffer.alloc(w * h * 4);
  for (let k = 0; k < inks.length; k++) {
    if (!keep[k]) continue;
    const L = layers[k];
    for (let p = 0; p < w * h; p++) {
      if (owner[p] !== k) continue;
      const i = p * 4;
      composite[i] = L[i]; composite[i + 1] = L[i + 1]; composite[i + 2] = L[i + 2]; composite[i + 3] = L[i + 3];
    }
  }

  const encode = (buf) => sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png({ compressionLevel: 9, palette: true }).toBuffer();
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.06);
  const box = {
    left: Math.max(0, minX - pad), top: Math.max(0, minY - pad),
    width: Math.min(w, maxX + pad + 1) - Math.max(0, minX - pad), height: Math.min(h, maxY + pad + 1) - Math.max(0, minY - pad),
  };
  const thumb = await sharp(composite, { raw: { width: w, height: h, channels: 4 } })
    .extract(box).resize({ width: 360, height: 360, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true }).toBuffer();

  return {
    width: w, height: h,
    composite: await encode(composite),
    thumb,
    layers: await Promise.all(inks.map(async (ink, k) => (keep[k] ? { ink: ink.hex, png: await encode(layers[k]) } : null)))
      .then((ls) => ls.filter(Boolean)),
  };
}
