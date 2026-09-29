// The inks every print is made from. The idea: one bright, saturated "hero" ink from the same family as the
// machine's theme colors carries the shape AND draws the lines (that's the pop and the contrast), and one or two
// soft pastels fill in around it (that's the cute part); the white paper is the lightest tone. No black.
export const BRIGHTS = {
  tomato: "#E0312B",
  cobalt: "#2F5FD0",
  jade: "#1F9E7A",
  tangerine: "#F07A1A",
  bubblegum: "#D6457C",
  violet: "#7A4FD1",
  mustard: "#C99A12",
};
export const PASTELS = {
  butter: "#FFE08A",
  peach: "#FFC2A1",
  blush: "#FFC9D8",
  sky: "#A9D8F7",
  mint: "#A8E6CC",
  lilac: "#D5C2F5",
};
export const PALETTE = { ...BRIGHTS, ...PASTELS };

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const dist = (a, b) => a.reduce((d, v, i) => d + (v - b[i]) ** 2, 0);
const lum = (h) => { const [r, g, b] = rgb(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

// 1-2 brights + 1-2 pastels (2-4 inks), lightest to darkest, so the darkest bright ends up last (the linework).
// Off-palette colors are snapped to the nearest palette ink; black snaps to a bright, never survives as black.
export function toPaletteInks(inks) {
  const values = Object.values(PALETTE);
  const snap = (c) => PALETTE[c.toLowerCase()] ||
    (/^#[0-9a-f]{6}$/i.test(c) ? values.reduce((best, p) => (dist(rgb(p), rgb(c)) < dist(rgb(best), rgb(c)) ? p : best)) : null);
  const picked = [...new Set((Array.isArray(inks) ? inks : []).map((c) => snap(String(c).trim())).filter(Boolean))];
  const brightSet = Object.values(BRIGHTS);
  const brights = picked.filter((c) => brightSet.includes(c)).slice(0, 2);
  const pastels = picked.filter((c) => !brightSet.includes(c)).slice(0, 2);
  if (!brights.length) brights.push(BRIGHTS.cobalt);
  if (!pastels.length) pastels.push(PASTELS.butter);
  return [...pastels, ...brights].sort((a, b) => lum(b) - lum(a));
}
