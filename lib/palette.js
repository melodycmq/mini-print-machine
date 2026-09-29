// The ink palette every print is made from: vibrant pastels, plus a few soft deep inks for the linework (never
// black). Claude picks 2-4 per print; anything off-palette is snapped to the nearest ink, so every city's prints
// look like part of one cute, cohesive collection.
export const PASTELS = {
  "butter yellow": "#FFD86E",
  peach: "#FFB48C",
  coral: "#FF8474",
  bubblegum: "#FF8FC4",
  blush: "#FFC3D5",
  lilac: "#C7A8F2",
  periwinkle: "#95ABF7",
  sky: "#8FD3F5",
  mint: "#8FE2C2",
  pistachio: "#BBDF8C",
};
export const LINE_INKS = {
  cornflower: "#4E6BD6",
  plum: "#7E5AAE",
  rosewood: "#C4546C",
  pine: "#3E8B6F",
};
export const PALETTE = { ...PASTELS, ...LINE_INKS };

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const dist = (a, b) => a.reduce((d, v, i) => d + (v - b[i]) ** 2, 0);
const lum = (h) => { const [r, g, b] = rgb(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

// 2-4 distinct palette inks, lightest to darkest, always ending in exactly one line ink.
// Off-palette colors are snapped to the nearest palette ink.
export function toPaletteInks(inks) {
  const values = Object.values(PALETTE);
  const snap = (c) => PALETTE[c.toLowerCase()] ||
    (/^#[0-9a-f]{6}$/i.test(c) ? values.reduce((best, p) => (dist(rgb(p), rgb(c)) < dist(rgb(best), rgb(c)) ? p : best)) : null);
  const picked = [...new Set((Array.isArray(inks) ? inks : []).map((c) => snap(String(c).trim())).filter(Boolean))];
  const lines = Object.values(LINE_INKS);
  const pastels = picked.filter((c) => !lines.includes(c)).slice(0, 3);
  const line = picked.find((c) => lines.includes(c)) || LINE_INKS.cornflower;
  if (!pastels.length) pastels.push(PASTELS.blush);
  return [...pastels.sort((a, b) => lum(b) - lum(a)), line];
}
