import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { redis, redisConfig, keys, slug, locate } from "../lib/store.js";
import { findCity } from "../lib/cities.js";
import { PALETTE, toPaletteInks } from "../lib/palette.js";

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const CLAUDE_EFFORT = process.env.CLAUDE_EFFORT || "low";

// GET /api/set[?city=Chicago]
// Returns this area's six prints: { key, edition, city, prints: [{ id, title, where, inks, image, thumb, layers }] }
// (image/thumb/layers are null until that print is first pulled).
// The list is written once per area by Claude and cached forever; images fill in as people play.
export default async function handler(req, res) {
  const place = locate(req);
  // Hand-picked places must be on the supported list. Detected places are always allowed, but if they match
  // a listed city they take its canonical spelling too, so "New York" (IP) and "New York City" (typed) share
  // one cached set instead of generating two.
  const hit = findCity(place.city, place.country);
  if (place.source === "chosen" && !hit) {
    return res.status(400).json({ error: "unsupported", detail: `We don't print for "${place.city}" yet.` });
  }
  if (hit) Object.assign(place, { city: hit.city, country: hit.country, region: place.region || hit.region || hit.countryName });
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
      prints: set.prints.map((p, i) => {
        const img = images[i] || {};
        return { id: p.id, title: p.title, where: p.where, inks: p.inks,
                 image: img.image || null, thumb: img.thumb || null, layers: img.layers || null };
      }),
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
  if (!redisConfig()) need.push("Upstash Redis (KV_REST_API_URL + KV_REST_API_TOKEN, or REDIS_URL)");
  return need;
}

async function createSet(cityKey, place, step) {
  step.name = "claude";
  const where = [place.city, place.region, place.country].filter(Boolean).join(", ");
  // Structured outputs: Claude's reply is constrained to PRINT_SET_SCHEMA and arrives already parsed, so a stray
  // quote mark in a description can't break it. One retry if it still comes back unusable.
  let json = null;
  for (let attempt = 0; attempt < 2 && !json; attempt++) {
    step.name = "claude";
    const started = Date.now();
    const msg = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      messages: [{ role: "user", content: subjectPrompt(where) }],
      // A short, simple list: low effort keeps it quick (thinking depth is the main cost of latency here).
      output_config: { format: jsonSchemaOutputFormat(PRINT_SET_SCHEMA), effort: CLAUDE_EFFORT },
    });
    console.log(`timing set ${cityKey}: claude ${Date.now() - started}ms (effort ${CLAUDE_EFFORT}, attempt ${attempt + 1})`);
    step.name = "parse-claude-reply";
    const out = msg.stop_reason === "refusal" ? null : msg.parsed_output;
    if (out && Array.isArray(out.prints) && out.prints.length >= 6) json = out;
    else console.warn("unusable print set from Claude, attempt", attempt + 1, msg.stop_reason, JSON.stringify(msg.content).slice(0, 500));
  }
  if (!json) throw new Error("Claude didn't return a usable set of 6 prints");
  const seen = new Set();
  const prints = (json.prints || []).slice(0, 6).map((p, i) => {
    let id = slug(p.id || p.title || `print-${i}`).slice(0, 24);
    while (seen.has(id)) id += "-x";
    seen.add(id);
    return {
      id,
      title: String(p.title || "").slice(0, 40),
      where: String(p.where || place.city).slice(0, 28),
      subject_zh: String(p.subject_zh || p.title || "").slice(0, 400),
      inks: toPaletteInks(p.inks),
    };
  });
  if (prints.length !== 6) throw new Error(`expected 6 prints, got ${prints.length}`);

  const set = { edition: String(json.edition || place.city).slice(0, 40), prints, createdAt: Date.now() };
  // If two first visitors race, keep whichever set landed first so everyone in the area shares one.
  step.name = "redis";
  const wrote = await redis.set(keys.set(cityKey), set, { nx: true });
  return wrote ? set : await redis.get(keys.set(cityKey));
}
