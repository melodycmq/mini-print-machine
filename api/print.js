import OpenAI from "openai";
import { put } from "@vercel/blob";
import { redis, ratelimit, keys, visitorId, takeFromDailyBudget, refundDailyBudget, nextUtcMidnight, markOutOfCredits, isOpenAICreditError } from "../lib/store.js";
import { printPrompt } from "../lib/style-prompt.js";
import { separate } from "../lib/separate.js";

const openai = new OpenAI(); // reads OPENAI_API_KEY
const IMAGE_MODEL = process.env.IMAGE_MODEL || "gpt-image-2";
const IMAGE_QUALITY = process.env.IMAGE_QUALITY || "low"; // low: faster to draw; the simple one-object style holds up well

// POST /api/print  { key, id }
// → 200 { status: "ready", image, thumb, layers: [{ url, ink }] }   the print exists (made now or earlier)
// → 202 { status: "pending" }             someone else is generating it; poll again in a few seconds
// → 503 { status: "busy" }                the image service is rate-limiting us; the page waits and retries
// → 429 / 503 { status: "limited" }       rate limit or daily budget hit; the page falls back to the NYC set
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { key, id } = req.body || {};
  if (typeof key !== "string" || typeof id !== "string") return res.status(400).json({ error: "key and id required" });

  const set = await redis.get(keys.set(key));
  const print = set?.prints.find((p) => p.id === id);
  if (!print) return res.status(404).json({ error: "Unknown print." });

  const existing = await redis.get(keys.image(key, id));
  if (existing) return res.status(200).json({ status: "ready", ...existing });

  // One generation per print, ever: whoever takes the lock makes it, everyone else polls.
  const locked = await redis.set(keys.lock(key, id), "1", { nx: true, ex: 180 });
  if (!locked) return res.status(202).json({ status: "pending" });

  let charged = false;
  try {
    // The seeding script sends the admin token to pre-draw cities without hitting the per-visitor limit
    // (the daily budget still applies).
    const admin = process.env.ADMIN_TOKEN && req.headers["x-admin-token"] === process.env.ADMIN_TOKEN;
    if (!admin) {
      const { success, reset } = await ratelimit.limit(visitorId(req));
      if (!success) return res.status(429).json({ status: "limited", reason: "rate", resetAt: reset });
    }
    if (!(await takeFromDailyBudget())) {
      await refundDailyBudget(); // the over-cap attempt itself shouldn't keep counting
      return res.status(503).json({ status: "limited", reason: "budget", resetAt: nextUtcMidnight() });
    }
    charged = true;

    const t0 = Date.now();
    const result = await drawImage(printPrompt(print.subject_zh, print.inks));
    const png = Buffer.from(result.data[0].b64_json, "base64");
    const t1 = Date.now();

    // Split into one layer per ink so the page can pull the print color by color.
    const sep = await separate(png, print.inks);
    const t2 = Date.now();
    const base = `prints/${key}/${id}`;
    const upload = (name, body) =>
      put(`${base}/${name}.png`, body, { access: "public", contentType: "image/png", addRandomSuffix: false, allowOverwrite: true })
        .then((b) => b.url);
    const [image, thumb, ...layerUrls] = await Promise.all([
      upload("print", sep.composite),
      upload("thumb", sep.thumb),
      ...sep.layers.map((l, k) => upload(`ink-${k}`, l.png)),
      put(`${base}/original.png`, png, { access: "public", contentType: "image/png", addRandomSuffix: false, allowOverwrite: true }),
    ]);
    const record = { image, thumb, layers: sep.layers.map((l, k) => ({ url: layerUrls[k], ink: l.ink })) };
    console.log(`timing print ${key}/${id}: draw ${t1 - t0}ms (${IMAGE_MODEL}, ${IMAGE_QUALITY}), split ${t2 - t1}ms, upload ${Date.now() - t2}ms`);
    await redis.set(keys.image(key, id), record);
    await redis.sadd(keys.reel(), thumb); // add this sticker to the pool the travel animation flips through
    return res.status(200).json({ status: "ready", ...record });
  } catch (err) {
    if (charged) await refundDailyBudget(); // nothing was made, so it shouldn't count against today's cap
    if (isOpenAICreditError(err)) { // an empty balance is not "busy": don't let the page keep retrying
      console.error("print failed: OpenAI credit balance is empty - top up at platform.openai.com", key, id);
      await markOutOfCredits("openai");
      return res.status(503).json({ status: "out_of_ink" });
    }
    if (err?.status === 429) return res.status(503).json({ status: "busy" }); // OpenAI rate limit: page retries
    console.error("print failed", key, id, err);
    return res.status(502).json({ status: "failed" });
  } finally {
    await redis.del(keys.lock(key, id));
  }
}

// Ask for a transparent background (the card is the paper). Some image models don't support that; for those, ask
// again without it - lib/separate.js knocks out a painted background and turns near-white into paper anyway.
export async function drawImage(prompt) {
  const base = { model: IMAGE_MODEL, prompt, size: "1024x1536", quality: IMAGE_QUALITY, output_format: "png", n: 1 };
  try {
    return await openai.images.generate({ ...base, background: "transparent" });
  } catch (err) {
    if (err?.status === 400 && (err.param === "background" || err.error?.param === "background")) {
      console.warn(`${IMAGE_MODEL} doesn't support transparent backgrounds; drawing on an opaque one instead`);
      return await openai.images.generate(base);
    }
    throw err;
  }
}
