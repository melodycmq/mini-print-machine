import { readFileSync } from "node:fs";

// The list of places a visitor can pick by hand. Shared with the page (public/cities.json).
// IP-detected locations aren't limited to it; this only guards typed-in choices.
const data = JSON.parse(readFileSync(new URL("../public/cities.json", import.meta.url), "utf8"));

export const norm = (s) => String(s || "")
  .normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Resolve a typed name (and optional ISO country code) to its canonical entry, or null if unsupported.
export function findCity(name, country) {
  const n = norm(name);
  const target = norm(data.aliases[n] || name);
  const cc = String(country || "").toUpperCase();
  const hit = data.cities.find(([c, k]) => norm(c) === target && (!cc || k === cc));
  if (!hit) return null;
  const [city, cc2, region = ""] = hit;
  return { city, country: cc2, region, countryName: data.countries[cc2] || cc2 };
}
