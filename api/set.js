import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { redis, redisConfig, keys, slug, locate } from "../lib/store.js";
import { findCity } from "../lib/cities.js";

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
      inks: cleanInks(p.inks),
    };
  });
  if (prints.length !== 6) throw new Error(`expected 6 prints, got ${prints.length}`);

  const set = { edition: String(json.edition || place.city).slice(0, 40), prints, createdAt: Date.now() };
  // If two first visitors race, keep whichever set landed first so everyone in the area shares one.
  step.name = "redis";
  const wrote = await redis.set(keys.set(cityKey), set, { nx: true });
  return wrote ? set : await redis.get(keys.set(cityKey));
}

// 3–4 valid hex inks, or a safe default set (warm, cool, accent, deep key line) if Claude's are unusable.
const DEFAULT_INKS = ["#F2C14E", "#E4572E", "#4C8FB8", "#232A4D"];
function cleanInks(inks) {
  const ok = (Array.isArray(inks) ? inks : [])
    .map((c) => String(c).trim())
    .filter((c) => /^#[0-9a-f]{6}$/i.test(c))
    .filter((c) => { const n = parseInt(c.slice(1), 16); return ((n >> 16) + ((n >> 8) & 255) + (n & 255)) / 3 < 235; }) // no near-whites
    .slice(0, 4);
  return ok.length >= 3 ? ok : DEFAULT_INKS;
}

// Local, story-driven choices of what to draw, each drawn as one or two simple objects (never a scene).
function subjectPrompt(where) {
  return `You are curating a set of 6 tiny art prints sold from a vending machine in ${where}.
The prints should feel like a local's inside joke or a love letter, not a tourism poster.

Pick 6 subjects that are whimsical, cultural and specific to this place: food rituals, street characters and
animals, everyday objects, customs, festivals, local slang made visible, small habits and quirks, niche
cultural references a resident would smile at. At most ONE well-known landmark, and only if shown in an
unexpected, playful way. Avoid anything generic that could be from anywhere, and avoid the obvious postcard list.
If the place is small, draw from its surrounding region.

Each print is a simple drawing of ONE main object (at most two), not a scene: tell the local story through which
object you pick and one small playful detail on it, never through a setting, a crowd, a room or a background.

For each print give an id, a 1–4 word English title (can be playful), a short location label for the card, and
"subject_zh": one sentence in Chinese for an illustrator describing just that object (or pair): what it is, its most
recognizable silhouette or pose, and the one small detail that makes it local and charming. Nothing with written words.

Also give each print 3 or 4 ink colors as hex codes: vivid, saturated and clean (think fresh screen-print inks), chosen to
suit the subject, lightest to darkest. No muddy, greyed, brown-grey or olive tones, and no near-whites. The last one is a
deep ink for the thin structural lines.`;
}

// The shape of one city's set. Counts (exactly 6 prints, 3–4 inks) are checked in code after parsing.
const PRINT_SET_SCHEMA = {
  type: "object",
  properties: {
    edition: { type: "string", description: 'The place name as it should appear on the machine, e.g. "Chicago" or "Lower Manhattan".' },
    prints: {
      type: "array",
      description: "Exactly six prints.",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Short lowercase slug, unique within the set." },
          title: { type: "string", description: "1–4 word English name for the print (can be playful)." },
          where: { type: "string", description: "Short English location label printed on the card (a street, neighborhood, park or venue; max 24 characters)." },
          subject_zh: { type: "string", description: "One sentence in Chinese describing just the one object (or pair) for an illustrator: what it is, its most recognizable silhouette or pose, and the one small detail that makes it local and charming. No scene, no background, nothing with written words." },
          inks: {
            type: "array", items: { type: "string" },
            description: "3 or 4 vivid, saturated, clean ink colors as hex codes (like #1F4686), lightest to darkest; the last is a deep ink for thin structural lines. No muddy or greyed tones, no near-whites.",
          },
        },
        required: ["id", "title", "where", "subject_zh", "inks"],
        additionalProperties: false,
      },
    },
  },
  required: ["edition", "prints"],
  additionalProperties: false,
};
