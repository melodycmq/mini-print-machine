import OpenAI from "openai";
import { put } from "@vercel/blob";
import { redis, ratelimit, keys, visitorId, takeFromDailyBudget } from "../lib/store.js";
import { printPrompt } from "../lib/style-prompt.js";

const openai = new OpenAI(); // reads OPENAI_API_KEY
const IMAGE_MODEL = process.env.IMAGE_MODEL || "gpt-image-2";
const IMAGE_QUALITY = process.env.IMAGE_QUALITY || "medium";

// POST /api/print  { key, id }
// → 200 { status: "ready", image }        the print exists (made now or earlier)
// → 202 { status: "pending" }             someone else is generating it; poll again in a few seconds
// → 429 / 503 { status: "limited" }       rate limit or daily budget hit; the page falls back to the NYC set
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { key, id } = req.body || {};
  if (typeof key !== "string" || typeof id !== "string") return res.status(400).json({ error: "key and id required" });

  const set = await redis.get(keys.set(key));
  const print = set?.prints.find((p) => p.id === id);
  if (!print) return res.status(404).json({ error: "Unknown print." });

  const existing = await redis.get(keys.image(key, id));
  if (existing) return res.status(200).json({ status: "ready", image: existing });

  // One generation per print, ever: whoever takes the lock makes it, everyone else polls.
  const locked = await redis.set(keys.lock(key, id), "1", { nx: true, ex: 180 });
  if (!locked) return res.status(202).json({ status: "pending" });

  try {
    const { success } = await ratelimit.limit(visitorId(req));
    if (!success) return res.status(429).json({ status: "limited", reason: "rate" });
    if (!(await takeFromDailyBudget())) return res.status(503).json({ status: "limited", reason: "budget" });

    const result = await openai.images.generate({
      model: IMAGE_MODEL,
      prompt: printPrompt(print.subject_zh),
      size: "1024x1536",
      quality: IMAGE_QUALITY,
      n: 1,
    });
    const png = Buffer.from(result.data[0].b64_json, "base64");
    const blob = await put(`prints/${key}/${id}.png`, png, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    await redis.set(keys.image(key, id), blob.url);
    return res.status(200).json({ status: "ready", image: blob.url });
  } catch (err) {
    console.error("print failed", key, id, err);
    return res.status(502).json({ status: "failed" });
  } finally {
    await redis.del(keys.lock(key, id));
  }
}
