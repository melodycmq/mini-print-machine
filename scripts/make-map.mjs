// Turns a map image into a seamless left↔right tile for the page background.
//   node scripts/make-map.mjs <input image> [public/map.webp]
// The tile is the image followed by a mirrored copy, so roads and rivers continue across both joins
// (a blended seam would ghost features that don't line up). Also prints the paper color for --page.
import sharp from "sharp";
const [input, output = "public/map.webp"] = process.argv.slice(2);
if (!input) { console.error("usage: node scripts/make-map.mjs <input image> [output.webp]"); process.exit(1); }

const img = sharp(input).removeAlpha();
const { width, height } = await img.metadata();
const flipped = await sharp(input).removeAlpha().flop().toBuffer();
await sharp({ create: { width: width * 2, height, channels: 3, background: "#ffffff" } })
  .composite([{ input: await img.toBuffer(), left: 0, top: 0 }, { input: flipped, left: width, top: 0 }])
  .webp({ quality: 78, effort: 6 })
  .toFile(output);

// Paper color = the brightest common tone (lines are dark, so take a high percentile of luminance).
const { data } = await sharp(input).removeAlpha().resize(200).raw().toBuffer({ resolveWithObject: true });
const px = []; for (let i = 0; i < data.length; i += 3) px.push([data[i], data[i + 1], data[i + 2]]);
px.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
const [r, g, b] = px[Math.floor(px.length * 0.8)];
const hex = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
const { size } = await import("node:fs").then((fs) => fs.statSync(output));
console.log(JSON.stringify({ output, tile: `${width * 2}x${height}`, kb: Math.round(size / 1024), paper: hex }));
