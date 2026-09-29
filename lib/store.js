import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { createHash } from "node:crypto";

// Works with either Upstash's own env names or the ones Vercel's Upstash integration sets.
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

// Only generations are limited; fetching an already-made print is free.
const generationsPerHour = Number(process.env.GENERATIONS_PER_IP_PER_HOUR || 12);
export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(generationsPerHour, "1 h"),
  prefix: "rl:gen",
});

export const keys = {
  set: (cityKey) => `set:${cityKey}`,
  image: (cityKey, id) => `img:${cityKey}:${id}`,
  lock: (cityKey, id) => `lock:${cityKey}:${id}`,
  setLock: (cityKey) => `lock:set:${cityKey}`,
  budget: () => `budget:${new Date().toISOString().slice(0, 10)}`,
};

export function slug(s) {
  return String(s)
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    .slice(0, 60) || "unknown";
}

// Visitor's rough location from Vercel's IP geolocation headers (no browser prompt).
// A `?city=` override (from the page's "change city" control) wins.
export function locate(req) {
  const h = (name) => {
    const v = req.headers[name];
    try { return v ? decodeURIComponent(v) : ""; } catch { return v || ""; }
  };
  const override = (req.query?.city || "").toString().trim().slice(0, 80);
  if (override) return { city: override, region: "", country: "", source: "chosen" };
  const city = h("x-vercel-ip-city");
  if (!city) return { city: "New York", region: "NY", country: "US", source: "default" };
  return { city, region: h("x-vercel-ip-country-region"), country: h("x-vercel-ip-country"), source: "ip" };
}

// Hash IPs before using them as rate-limit keys so raw addresses never land in the database.
export function visitorId(req) {
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
  return createHash("sha256").update(ip + (process.env.IP_SALT || "mini-print")).digest("hex").slice(0, 32);
}

// Global daily spending cap: returns false once today's generations exceed the limit.
export async function takeFromDailyBudget() {
  const cap = Number(process.env.DAILY_GENERATION_CAP || 150);
  const k = keys.budget();
  const used = await redis.incr(k);
  if (used === 1) await redis.expire(k, 60 * 60 * 48);
  return used <= cap;
}
