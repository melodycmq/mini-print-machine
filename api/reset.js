import { redis, keys, slug } from "../lib/store.js";
import { findCity } from "../lib/cities.js";

// POST /api/reset?city=Shanghai&country=CN   (header x-admin-token: <ADMIN_TOKEN>)
// Forgets one city's saved set and drawings, so its next visit picks and draws it fresh.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!process.env.ADMIN_TOKEN || req.headers["x-admin-token"] !== process.env.ADMIN_TOKEN) return res.status(403).json({ error: "forbidden" });
  const hit = findCity(req.query?.city, req.query?.country);
  const city = hit?.city || String(req.query?.city || ""), country = hit?.country || String(req.query?.country || "");
  if (!city) return res.status(400).json({ error: "city required" });
  const cityKey = [slug(city), slug(country || "x")].join("--");
  const set = await redis.get(keys.set(cityKey));
  const ids = set?.prints?.map((p) => p.id) || [];
  const removed = await redis.del(keys.set(cityKey), ...ids.map((id) => keys.image(cityKey, id)));
  res.status(200).json({ city: cityKey, removedKeys: removed });
}
