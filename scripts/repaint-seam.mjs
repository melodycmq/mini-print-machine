// Repaints only the seam strip of an offset map, keeping every other pixel of the original.
//   OPENAI_API_KEY=... node scripts/repaint-seam.mjs <offset.png> <mask.png> [out.png]
// The mask is transparent where to repaint (a vertical strip). A square around the strip is sent to OpenAI's image
// edit API (scaled evenly, so nothing stretches), then only the strip is taken from the result and pasted back onto
// the original with a soft edge - so even if the model redraws the whole square a little, nothing outside the strip
// changes. The result tiles left-right with no seam (its outer edges were neighbours in the original map).
import OpenAI, { toFile } from "openai";
import sharp from "sharp";

const [offsetPath, maskPath, outPath = `${process.env.HOME}/Desktop/map-repaired.png`] = process.argv.slice(2);
if (!offsetPath || !maskPath || !process.env.OPENAI_API_KEY) {
  console.error("usage: OPENAI_API_KEY=... node scripts/repaint-seam.mjs <offset.png> <mask.png> [out.png]");
  process.exit(1);
}
const MODEL = process.env.IMAGE_MODEL || "gpt-image-2";
const FEATHER = 24; // px of soft edge on each side of the pasted strip

const base = sharp(offsetPath).removeAlpha();
const { width: W, height: H } = await base.metadata();

// Find the strip to repaint from the mask's transparent columns.
const { data: alpha } = await sharp(maskPath).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
const clear = (x) => alpha[Math.floor(H / 2) * W + x] < 128;
let x0 = 0; while (x0 < W && !clear(x0)) x0++;
let x1 = x0; while (x1 < W && clear(x1)) x1++;
if (x0 >= W) throw new Error("mask has no transparent strip");
console.log(`strip to repaint: x ${x0}–${x1} (${x1 - x0}px)`);

// A square crop centred on the strip, as large as the image height allows.
const S = Math.min(H, W);
const cx = Math.round((x0 + x1) / 2);
const left = Math.max(0, Math.min(W - S, cx - Math.round(S / 2)));
const crop = await sharp(offsetPath).removeAlpha().extract({ left, top: 0, width: S, height: S }).resize(1024, 1024, { kernel: "lanczos3" }).png().toBuffer();
const cropMask = await sharp(maskPath).ensureAlpha().extract({ left, top: 0, width: S, height: S }).resize(1024, 1024, { kernel: "nearest" }).png().toBuffer();

const prompt = `Repaint only the transparent vertical strip of this city map so the streets and the river on both sides join
naturally, as one continuous map. The river enters the strip from the bottom on the left side and must leave it on the right
side about a third of the way down; connect them with one naturally curving river. Remove the small white four-point star.
Keep the exact style: pale blue-grey paper, very faint thin navy lines, the same weight of main roads and small streets, soft
pale river and park fills. Do not change anything outside the strip. No text, labels, icons, shadows or 3D.`;

console.log(`asking ${MODEL} to repaint the strip…`);
const openai = new OpenAI();
const result = await openai.images.edit({
  model: MODEL,
  image: await toFile(crop, "map.png", { type: "image/png" }),
  mask: await toFile(cropMask, "mask.png", { type: "image/png" }),
  prompt,
  size: "1024x1024",
});
const edited = await sharp(Buffer.from(result.data[0].b64_json, "base64")).removeAlpha().resize(S, S, { kernel: "lanczos3" }).raw().toBuffer();

// Paste the strip (plus a feathered edge) back onto the untouched original.
const { data: orig } = await sharp(offsetPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const out = Buffer.from(orig);
const smooth = (t) => t * t * (3 - 2 * t);
for (let y = 0; y < H; y++) {
  for (let x = Math.max(0, x0 - FEATHER); x < Math.min(W, x1 + FEATHER); x++) {
    if (x < left || x >= left + S) continue;
    const w = x < x0 ? smooth((x - (x0 - FEATHER)) / FEATHER) : x >= x1 ? smooth(((x1 + FEATHER) - x) / FEATHER) : 1;
    const o = (y * W + x) * 3, e = (y * S + (x - left)) * 3;
    for (let c = 0; c < 3; c++) out[o + c] = Math.round(orig[o + c] * (1 - w) + edited[e + c] * w);
  }
}
await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png().toFile(outPath);
console.log(`saved ${outPath} - only x ${Math.max(0, x0 - FEATHER)}–${Math.min(W, x1 + FEATHER)} differs from the original`);
