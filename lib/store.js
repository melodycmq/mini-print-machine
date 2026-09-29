import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { createHash } from "node:crypto";

// Find Upstash's REST credentials under whatever names the Vercel integration used:
// UPSTASH_REDIS_REST_*, KV_REST_API_*, either with a custom prefix (e.g. STORAGE_KV_REST_API_URL),
// or, failing those, derive them from a rediss://default:<token>@<host>:<port> REDIS_URL.
export function redisConfig(env = process.env) {
  const find = (re) => Object.keys(env).sort().find((k) => re.test(k) && env[k]);
  const urlKey = find(/(UPSTASH_REDIS_REST_URL|KV_REST_API_URL)$/);
  const tokenKey = find(/(UPSTASH_REDIS_REST_TOKEN|KV_REST_API_TOKEN)$/);
  if (urlKey && tokenKey) return { url: env[urlKey], token: env[tokenKey], from: `${urlKey} + ${tokenKey}` };
  const tcpKey = find(/(^|_)(REDIS_URL|KV_URL)$/);
  if (tcpKey) {
    try {
      const u = new URL(env[tcpKey]);
      if (u.hostname.endsWith("upstash.io") && u.password) {
        return { url: `https://${u.hostname}`, token: decodeURIComponent(u.password), from: tcpKey };
      }
    } catch {}
  }
  return null;
}

const cfg = redisConfig();
export const redis = new Redis({ url: cfg?.url, token: cfg?.token });

// Only generations are limited; fetching an already-made print is free.
// Landing on a new city draws all six stickers at once, so this allows ~5 new cities per visitor per hour.
const generationsPerHour = Number(process.env.GENERATIONS_PER_IP_PER_HOUR || 30);
export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(generationsPerHour, "1 h"),
  prefix: "rl:gen",
});

// Bump when the subject or style prompts change: every city then gets a fresh set in the new style,
// and the old sets and images are simply never read again.
export const STYLE_VERSION = "v3"; // v3: local subjects drawn as one or two simple objects, vivid 3–4 inks

export const keys = {
  set: (cityKey) => `set:${STYLE_VERSION}:${cityKey}`,
  image: (cityKey, id) => `img:${STYLE_VERSION}:${cityKey}:${id}`,
  lock: (cityKey, id) => `lock:${STYLE_VERSION}:${cityKey}:${id}`,
  reel: () => `reel:${STYLE_VERSION}`, // every sticker ever drawn; the travel animation flips through these
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
  if (override) {
    const country = (req.query?.country || "").toString().trim().slice(0, 2).toUpperCase();
    return { city: override, region: "", country, source: "chosen" };
  }
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

export async function refundDailyBudget() {
  await redis.decr(keys.budget());
}
