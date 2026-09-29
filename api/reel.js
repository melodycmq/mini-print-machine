import { redis, keys } from "../lib/store.js";

// GET /api/reel → { faces: [thumbUrl, …] }
// A random handful of stickers from every city drawn so far, for the machine to flip through while traveling.
export default async function handler(req, res) {
  try {
    const faces = (await redis.srandmember(keys.reel(), 36)) || [];
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    res.status(200).json({ faces });
  } catch (err) {
    console.error("reel failed", err);
    res.status(200).json({ faces: [] });
  }
}
