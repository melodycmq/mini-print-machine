import Anthropic from "@anthropic-ai/sdk";
import { redis, keys, slug, locate } from "../lib/store.js";

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

// GET /api/set[?city=Chicago]
// Returns this area's six prints: { key, edition, city, prints: [{ id, title, where, image|null }] }.
// The list is written once per area by Claude and cached forever; images fill in as people play.
export default async function handler(req, res) {
  const place = locate(req);
  const cityKey = [slug(place.city), slug(place.country || "x")].join("--");

  // Which step failed goes back to the browser (no secrets), so a broken setup is easy to spot.
  const step = { name: "config" };
  try {
    const missing = missingConfig();
    if (missing.length) throw Object.assign(new Error(`missing env: ${missing.join(", ")}`), { hint: missing });
    step.name = "redis";
    let set = await redis.get(keys.set(cityKey));
    if (!set) set = await createSet(cityKey, place, step);
    step.name = "redis";
    const images = await redis.mget(...set.prints.map((p) => keys.image(cityKey, p.id)));
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      key: cityKey,
      edition: set.edition,
      city: place.city,
      source: place.source,
      prints: set.prints.map((p, i) => ({ id: p.id, title: p.title, where: p.where, image: images[i] || null })),
    });
  } catch (err) {
    console.error("set failed", cityKey, step.name, err);
    res.status(502).json({
      error: "Couldn't load prints for this area.",
      step: step.name,
      detail: err.hint ? `Missing environment variables: ${err.hint.join(", ")}` : err.status ? `HTTP ${err.status}: ${err.error?.error?.type || err.name}` : err.name,
    });
  }
}

function missingConfig() {
  const need = [];
  if (!process.env.ANTHROPIC_API_KEY) need.push("ANTHROPIC_API_KEY");
  if (!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)) need.push("KV_REST_API_URL (Upstash Redis)");
  if (!(process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)) need.push("KV_REST_API_TOKEN (Upstash Redis)");
  return need;
}

async function createSet(cityKey, place, step) {
  step.name = "claude";
  const where = [place.city, place.region, place.country].filter(Boolean).join(", ");
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{
      role: "user",
      content:
`You are curating a set of 6 tiny art prints sold from a vending machine in ${where}.
Pick 6 things that are iconic, interesting or quietly beautiful about this specific place, the kind a local would smile at:
a mix of landmarks, food, street life, nature and small everyday details. Avoid generic subjects that could be anywhere.
If the place is small, draw from its surrounding area.

For each print give:
- "id": short lowercase slug, unique within the set
- "title": 1–4 word English name of the subject
- "where": short English location label printed on the card (a street, neighborhood, park or venue; max 24 characters)
- "subject_zh": one sentence in Chinese describing only the subject for an illustrator: what it is, its most recognizable
  silhouette or pose, and at most one small hint of setting. Nothing with written words on it.

Also give "edition": the place name as it should appear on the machine (e.g. "Chicago", "Lower Manhattan").

Reply with JSON only, no prose: {"edition": "...", "prints": [{"id": "...", "title": "...", "where": "...", "subject_zh": "..."}]}`,
    }],
  });

  step.name = "parse-claude-reply";
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  const seen = new Set();
  const prints = (json.prints || []).slice(0, 6).map((p, i) => {
    let id = slug(p.id || p.title || `print-${i}`).slice(0, 24);
    while (seen.has(id)) id += "-x";
    seen.add(id);
    return {
      id,
      title: String(p.title || "").slice(0, 40),
      where: String(p.where || place.city).slice(0, 28),
      subject_zh: String(p.subject_zh || p.title || "").slice(0, 300),
    };
  });
  if (prints.length !== 6) throw new Error(`expected 6 prints, got ${prints.length}`);

  const set = { edition: String(json.edition || place.city).slice(0, 40), prints, createdAt: Date.now() };
  // If two first visitors race, keep whichever set landed first so everyone in the area shares one.
  step.name = "redis";
  const wrote = await redis.set(keys.set(cityKey), set, { nx: true });
  return wrote ? set : await redis.get(keys.set(cityKey));
}
