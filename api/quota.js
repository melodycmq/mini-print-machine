import { ratelimit, visitorId, generationsPerHour, dailyBudgetLeft, nextUtcMidnight, outOfCredits } from "../lib/store.js";

// GET /api/quota → { remaining, resetAt, limitedBy }
// How many new drawings can still be started for this visitor right now: the lower of their hourly allowance
// and what's left of the site's daily budget, with when that limit refills. The page uses it to decline a trip
// (or an arrival) it couldn't finish drawing, with a friendly "printer's out of ink" note.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (await outOfCredits()) return res.status(200).json({ remaining: 0, resetAt: null, limitedBy: "credits" });
    const [{ remaining: hourly, reset }, daily] = await Promise.all([ratelimit.getRemaining(visitorId(req)), dailyBudgetLeft()]);
    const dailyIsTighter = daily < hourly;
    res.status(200).json({
      remaining: Math.min(hourly, daily),
      resetAt: dailyIsTighter ? nextUtcMidnight() : reset,
      limitedBy: dailyIsTighter ? "day" : "hour",
      perHour: generationsPerHour,
    });
  } catch (err) {
    console.error("quota failed", err);
    res.status(200).json({ remaining: null, resetAt: null });
  }
}
