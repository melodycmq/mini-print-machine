// Pre-draws cities on the live site so the machine has plenty of stickers to flip through while traveling,
// and so those cities land instantly for visitors.
//
//   ADMIN_TOKEN=... node scripts/seed-cities.mjs https://your-site.vercel.app "Chicago,US" "Tokyo,JP" "Paris,FR"
//
// Costs about six images per new city (cities already drawn cost nothing). Uses the same ADMIN_TOKEN you set
// in Vercel so it isn't stopped by the per-visitor limit; the daily cap (DAILY_GENERATION_CAP) still applies.
const [site, ...places] = process.argv.slice(2);
const token = process.env.ADMIN_TOKEN;
if (!site || !places.length || !token) {
  console.error('usage: ADMIN_TOKEN=... node scripts/seed-cities.mjs <site url> "City,CC" ["City,CC" ...]');
  process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const place of places) {
  const [city, country = ""] = place.split(",").map((s) => s.trim());
  const r = await fetch(`${site}/api/set?city=${encodeURIComponent(city)}&country=${country}`);
  const set = await r.json();
  if (!r.ok) { console.log(`✗ ${city}: ${set.detail || set.error}`); continue; }
  console.log(`${set.edition}: ${set.prints.map((p) => p.title).join(" · ")}`);
  await Promise.all(set.prints.map(async (p) => {
    if (p.image) return console.log(`  ✓ ${p.title} (already drawn)`);
    for (let attempt = 0; attempt < 60; attempt++) {
      const res = await fetch(`${site}/api/print`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ key: set.key, id: p.id }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 200) return console.log(`  ✓ ${p.title}`);
      if (res.status === 202 || j.status === "busy") { await sleep(5000); continue; }
      return console.log(`  ✗ ${p.title}: ${j.status || res.status}${j.reason ? ` (${j.reason})` : ""}`);
    }
    console.log(`  ✗ ${p.title}: timed out`);
  }));
}
