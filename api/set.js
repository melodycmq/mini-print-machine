import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { redis, redisConfig, keys, slug, locate } from "../lib/store.js";
import { findCity } from "../lib/cities.js";
import { PASTELS, LINE_INKS, toPaletteInks } from "../lib/palette.js";

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const CLAUDE_EFFORT = process.env.SUBJECT_EFFORT || "low";

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

// Recognizable icons of the place, each drawn as one or two simple objects (never a scene), all six clearly
// different, inked in 2-4 colors from the shared pastel palette.
function subjectPrompt(where) {
  return `You are curating a set of 6 tiny art prints sold from a vending machine in ${where}.
Pick 6 things that are iconic and instantly recognizable as this place: its famous foods and drinks, landmarks,
well-known symbols, beloved local animals and everyday objects that everyone associates with it. Anyone who has visited
(or seen it in films) should recognize each one right away. One or two can be charming or playful, but avoid obscure or
insider-only references. If the place is small, draw from its surrounding region.

All six must be clearly different from each other: never two of the same kind of thing (one pizza at most, one cat at
most, one coffee at most, and so on), spread across different categories (food or drink, a landmark or symbol, an
animal, an everyday object, something worn or carried).

Each print is a simple drawing of ONE main object (at most two), not a scene: no setting, no crowd, no room, no
background, and no people unless the subject itself is one iconic figure.

For each print give an id, a 1–4 word English title, a short location label for the card, and "subject_zh": one
sentence in Chinese for an illustrator describing just that object: what it is, its most recognizable silhouette or
pose, and at most one small charming detail. Nothing with written words.

Ink each print in 2 to 4 colors, chosen by name from this palette only. Pick 1 to 3 pastels:
${Object.keys(PASTELS).join(", ")}; and exactly ONE soft deep ink for the thin linework: ${Object.keys(LINE_INKS).join(", ")}.
Choose cute, harmonious combinations that suit the object. The white paper is not an ink and never needs listing.`;
}

// The shape of one city's set. Counts (exactly 6 prints, 2-4 inks) are checked in code after parsing.
const PRINT_SET_SCHEMA = {
  type: "object",
  properties: {
    edition: { type: "string", description: 'The place name as it should appear on the machine, e.g. "Chicago" or "Lower Manhattan".' },
    prints: {
      type: "array",
      description: "Exactly six prints: recognizable icons of the place, all clearly different kinds of things.",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Short lowercase slug, unique within the set." },
          title: { type: "string", description: "1–4 word English name of the subject." },
          where: { type: "string", description: "Short English location label printed on the card (a street, neighborhood, park or venue; max 24 characters)." },
          subject_zh: { type: "string", description: "One sentence in Chinese describing just that object for an illustrator: what it is, its most recognizable silhouette or pose, and at most one small charming detail. No scene, no background, nothing with written words." },
          inks: { type: "array", items: { type: "string" }, description: "1 to 3 pastel ink names plus exactly one line ink name, all from the palette." },
        },
        required: ["id", "title", "where", "subject_zh", "inks"],
        additionalProperties: false,
      },
    },
  },
  required: ["edition", "prints"],
  additionalProperties: false,
};
