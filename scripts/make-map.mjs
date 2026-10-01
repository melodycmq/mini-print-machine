// Turns a map image into a seamless left↔right tile for the page background, with no mirroring.
//   node scripts/make-map.mjs <input image> [public/map.webp] [blend px]
// A strip from the right edge is cross-faded into the left edge, so the tile's right side flows straight into its
// left side when repeated. Inside the overlap the darker of the two images is kept (lines are dark on pale paper),
// so both street networks stay crisp instead of ghosting at half strength; it just reads as a busier part of town.
// Also prints the paper color for --page.
import sharp from "sharp";
import { statSync } from "node:fs";

const [input, output = "public/map.webp", blendArg] = process.argv.slice(2);
if (!input) { console.error("usage: node scripts/make-map.mjs <input image> [output.webp] [blend px]"); process.exit(1); }

const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const B = Math.min(Number(blendArg) || Math.round(W * 0.22), Math.floor(W / 2)); // overlap width
const OW = W - B;
const out = Buffer.alloc(OW * H * C);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

for (let y = 0; y < H; y++) {
  for (let x = 0; x < OW; x++) {
    const o = (y * OW + x) * C;
    if (x >= B) { data.copy(out, o, (y * W + x) * C, (y * W + x) * C + C); continue; }
    // x in the overlap: left-edge pixel a fades in, right-edge pixel b fades out.
    const t = x / B, wa = t * t * (3 - 2 * t), wb = 1 - wa; // smoothstep
    const ia = (y * W + x) * C, ib = (y * W + (W - B + x)) * C;
    for (let c = 0; c < C; c++) {
      const a = data[ia + c], b = data[ib + c];
      const mixed = a * wa + b * wb;
      // Each side's lines keep full strength until its weight drops below ~1/3, then fade out.
      const keepA = 255 + (a - 255) * clamp01(wa * 3), keepB = 255 + (b - 255) * clamp01(wb * 3);
      out[o + c] = Math.round(Math.min(mixed, keepA, keepB));
    }
  }
}

await sharp(out, { raw: { width: OW, height: H, channels: C } }).webp({ quality: 80, effort: 6 }).toFile(output);

// Paper color = a high percentile of brightness (lines are dark).
const { data: small } = await sharp(input).removeAlpha().resize(200).raw().toBuffer({ resolveWithObject: true });
const px = [];
for (let i = 0; i < small.length; i += 3) px.push([small[i], small[i + 1], small[i + 2]]);
px.sort((p, q) => p[0] + p[1] + p[2] - (q[0] + q[1] + q[2]));
const paper = "#" + px[Math.floor(px.length * 0.8)].map((v) => v.toString(16).padStart(2, "0")).join("");
console.log(JSON.stringify({ output, tile: `${OW}x${H}`, blend: B, kb: Math.round(statSync(output).size / 1024), paper }));
