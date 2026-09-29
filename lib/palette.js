// The ink palette every print is made from: classic relief/screen-print colors, taken from real mini prints.
// Claude picks 1-3 of these per print; anything off-palette is snapped to the nearest one, so every city's prints
// look like part of one collection.
export const PALETTE = {
  cobalt: "#2B4FB3",
  "sky blue": "#86B6E8",
  "cherry red": "#D7332B",
  tomato: "#E9573D",
  "bubblegum pink": "#EE6FA8",
  "blush pink": "#F4AABD",
  "forest green": "#2F6B47",
  sage: "#93B27E",
  mustard: "#E6B42E",
  tangerine: "#F08A2C",
  cocoa: "#7A4A33",
};

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const dist = (a, b) => a.reduce((d, v, i) => d + (v - b[i]) ** 2, 0);

// 1-3 distinct palette inks, lightest to darkest. Off-palette colors are snapped to the nearest palette ink.
export function toPaletteInks(inks) {
  const values = Object.values(PALETTE);
  const snapped = (Array.isArray(inks) ? inks : [])
    .map((c) => String(c).trim())
    .map((c) => PALETTE[c.toLowerCase()] || (/^#[0-9a-f]{6}$/i.test(c) ? values.reduce((best, p) => (dist(rgb(p), rgb(c)) < dist(rgb(best), rgb(c)) ? p : best)) : null))
    .filter(Boolean);
  const unique = [...new Set(snapped)].slice(0, 3);
  const lum = (h) => { const [r, g, b] = rgb(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  return (unique.length ? unique : [PALETTE.cobalt]).sort((a, b) => lum(b) - lum(a));
}
