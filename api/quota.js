import { ratelimit, visitorId, generationsPerHour } from "../lib/store.js";

// GET /api/quota → { remaining, limit, resetAt }
// How many new drawings this visitor can still start this hour, so the page can decline a trip to a city it
// couldn't finish drawing (instead of spinning and landing on "?" stickers).
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const { remaining, reset } = await ratelimit.getRemaining(visitorId(req));
    res.status(200).json({ remaining, limit: generationsPerHour, resetAt: reset });
  } catch (err) {
    console.error("quota failed", err);
    res.status(200).json({ remaining: null, limit: generationsPerHour, resetAt: null });
  }
}
