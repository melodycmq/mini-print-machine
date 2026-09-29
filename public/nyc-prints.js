// Hand-drawn New York set: the machine's offline fallback when the generator is unavailable.
// Thin shaky pen line + flat acrylic blocks, at most 4 colors each, drawn small on a lot of paper.
(() => {
  const P = (d, fill, line) => ({ t: "path", a: { d }, fill, line });
  const C = (cx, cy, r, fill, line) => ({ t: "circle", a: { cx, cy, r }, fill, line });
  const L = (d, stroke) => ({ t: "path", a: { d }, stroke });
  const DOT = (cx, cy, r, fill) => ({ t: "circle", a: { cx, cy, r }, solid: fill || true });
  const SOLID = (d, fill) => ({ t: "path", a: { d }, solid: fill || true });
  const T = (x, y, text, size, fill, rot = 0) => ({ t: "text", x, y, text, size, fill, rot });

  const NYC_PRINTS = [
    { id: "liberty", title: "Statue of Liberty", where: "Liberty Island", line: "#22435A",
      shapes: [
        P("M49 98 L71 98 L69 86 L51 86Z", "#E9D7B5"),
        P("M53 86 Q52 70 55 58 L58 50 L63 50 L66 58 Q69 70 67 86Z", "#6FB7A3"),
        P("M62 52 L66 40 L67.5 32 L70 32 L69 41 L65 53Z", "#6FB7A3"),
        C(60.5, 46.5, 3.2, "#6FB7A3"),
        P("M68 30.5 Q65.5 25 69.3 20.5 Q72.6 25.5 70.6 30.5Z", "#F2A33A")
      ],
      details: [
        L("M49 98 L71 98 M51 86 L69 86 M50 98 L52 86 M70 98 L68 86"),
        L("M55.5 60 Q53 72 54 86"), L("M59 62 L58 84"), L("M63 60 L64 84"),
        L("M57.5 44.5 l-3 -3 M59.5 43.4 l-1 -4 M62 43.4 l1 -4 M63.8 44.5 l3 -3"),
        L("M53 61 L57 59 L59 66.5 L55 67.5Z"),
        L("M67.6 32 L70 32"),
        L("M26 101 q5 -2.5 10 0 q5 2.5 10 0"), L("M76 103 q5 -2.5 10 0 q5 2.5 10 0")
      ] },
    { id: "bridge", title: "Brooklyn Bridge", where: "DUMBO", line: "#3B3A5A",
      shapes: [
        C(88, 30, 6, "#E8583D"),
        P("M42 98 L44 40 L76 40 L78 98 L69 98 L69 66 Q66 55 63 66 L63 98 L57 98 L57 66 Q54 55 51 66 L51 98Z", "#D9B99B"),
        P("M16 100 L104 100 L104 104.5 L16 104.5Z", "#7FA7C9")
      ],
      details: [
        L("M44 40 L76 40 M43 46 L77 46"),
        L("M51 98 L51 66 Q54 55 57 66 L57 98 M63 98 L63 66 Q66 55 69 66 L69 98"),
        L("M44 38 Q32 66 14 86"), L("M76 38 Q88 66 106 86"),
        L("M38 51 v29 M32 62 v18 M26 71 v9 M82 51 v29 M88 62 v18 M94 71 v9"),
        L("M12 80 L43 80 M77 80 L108 80")
      ] },
    { id: "chrysler", title: "Chrysler Building", where: "Lexington Ave", line: "#2C2F4A",
      shapes: [
        C(60, 62, 25, "#F3C6BE"),
        P("M48 106 L48 76 L72 76 L72 106Z", "#C9CCD6"),
        P("M49 76 Q49 64 60 60 Q71 64 71 76Z", "#C9CCD6"),
        P("M52.5 64 Q52.5 54 60 51 Q67.5 54 67.5 64Z", "#C9CCD6"),
        P("M55.5 53 Q55.5 46.5 60 44.5 Q64.5 46.5 64.5 53Z", "#C9CCD6"),
        P("M59 44.5 L60 20 L61 44.5Z", "#C9CCD6"),
        P("M52.5 74 L54.5 68 L56.5 74Z", "#E5B94A"), P("M58 74 L60 67 L62 74Z", "#E5B94A"), P("M63.5 74 L65.5 68 L67.5 74Z", "#E5B94A"),
        P("M56 62 L58 57 L60 62Z", "#E5B94A"), P("M60 62 L62 57 L64 62Z", "#E5B94A")
      ],
      details: [
        L("M49 76 Q49 64 60 60 Q71 64 71 76"), L("M52.5 64 Q52.5 54 60 51 Q67.5 54 67.5 64"), L("M55.5 53 Q55.5 46.5 60 44.5 Q64.5 46.5 64.5 53"),
        L("M60 44.5 L60 20"),
        L("M48 106 L48 76 L72 76 L72 106 M54 104 V79 M60 104 V79 M66 104 V79")
      ] },
    { id: "cab", title: "Yellow Cab", where: "7th Ave", line: "#2B2B3A",
      shapes: [
        P("M32 84 L33 76 Q34 72 40 72 L46 71 L51 63 Q52 61 55 61 L69 61 Q72 61 74 64 L79 71 L85 72 Q89 73 89 77 L89 84Z", "#F2C230"),
        P("M53 64 L60 64 L60 70.5 L49 70.5Z", "#BFD9E6"), P("M63 64 L70 64 Q71.5 64 72.5 65.5 L76 70.5 L63 70.5Z", "#BFD9E6"),
        C(42, 84, 5.4, "#2B2B3A"), C(79, 84, 5.4, "#2B2B3A"), C(42, 84, 1.8, "#BFD9E6"), C(79, 84, 1.8, "#BFD9E6")
      ],
      details: [
        L("M33 76 Q34 72 40 72 L46 71 L51 63 Q52 61 55 61 L69 61 Q72 61 74 64 L79 71 L85 72 Q89 73 89 77"),
        L("M58.5 61 L59 57.5 L66 57.5 L66.5 61"),
        L("M61.5 71 V83"),
        SOLID("M36 75 h3 v2.5 h-3z M42 75 h3 v2.5 h-3z M48 75 h3 v2.5 h-3z M54 75 h3 v2.5 h-3z M66 75 h3 v2.5 h-3z M72 75 h3 v2.5 h-3z M78 75 h3 v2.5 h-3z"),
        L("M22 90 L98 90"), L("M30 95 h6 M48 95 h6 M66 95 h6 M84 95 h6")
      ] },
    { id: "cat", title: "Bodega Cat", where: "Corner Bodega", line: "#2E2A3A",
      shapes: [
        P("M44 100 L76 100 L76 84 L44 84Z", "#7FAE6A"),
        P("M50 84 Q47 72 53 66 Q51 62 52 55.5 L55.5 59 L59.5 59 L63 55.5 Q64 62 62 66 Q69 72 66 84Z", "#E98B3A"),
        P("M65.5 82 Q77 81 74.5 70 Q73.5 67.5 72 69.5 Q73.5 78 64.5 78.5Z", "#E98B3A")
      ],
      details: [
        L("M44 100 L76 100 L76 84 L44 84Z"), L("M48 88 h7 M58 88 h4 M65 88 h7 M44 94 H76 M52 84 V100 M60 84 V100 M68 84 V100"),
        L("M52 72 q3 1.2 5 0"), L("M58.5 76 q3 1.2 5 0"), L("M53 79 q2.5 1 4.5 0"),
        L("M55.5 59.8 v2 M57.5 59.3 v2.5 M59.5 59.8 v2"),
        DOT(55.2, 63, .8), DOT(59.8, 63, .8), L("M57.5 64.6 l-.8 .8 M57.5 64.6 l.8 .8"),
        L("M78 44 H96 V56 H78Z", "#D94A3A"), T(87, 53.4, "OPEN", 7.4, "#D94A3A"),
        L("M34 100 H86")
      ] },
    { id: "slice", title: "Dollar Slice", where: "Bleecker St.", line: "#3A2E2A",
      shapes: [
        P("M42 52 Q61 45 80 52 L63 90 Q61 93 59 90Z", "#F4C542"),
        P("M73.8 63 Q75.5 71 72.6 72.2 Q70.4 71.6 71.2 67.5Z", "#F4C542"),
        P("M39 47 Q61 38 83 47 Q84 52 80 53 Q61 45 42 53 Q38 52 39 47Z", "#D99A5B"),
        C(53, 58, 3.4, "#D9473A"), C(67, 57.5, 3, "#D9473A"), C(60, 70, 3.2, "#D9473A"), C(61, 81, 2, "#D9473A")
      ],
      details: [
        L("M42 53 Q61 45 80 53"), L("M39 47 Q61 38 83 47"),
        L("M42 53 L59 90 Q61 93 63 90 L73 67"),
        L("M28 92 a33 7.5 0 1 0 66 0 a33 7.5 0 1 0 -66 0")
      ] }
  ];

  const attrs = (o) => Object.entries(o).map(([k, v]) => `${k}="${v}"`).join(" ");
  function artSVG(p, box = "0 0 120 120") {
    let fills = "", lines = "", i = 0;
    for (const s of p.shapes) {
      const a = attrs(s.a);
      fills += `<${s.t} ${a} fill="${s.fill}"/>`;
      if (s.line) lines += `<${s.t} class="l" pathLength="1" ${a} style="--i:${i++};stroke:${s.line}"/>`;
    }
    for (const d of p.details) {
      if (d.t === "text") {
        lines += `<text class="f" style="--i:${i++}" x="${d.x}" y="${d.y}" font-size="${d.size}" text-anchor="middle" fill="${d.fill || p.line}"${d.rot ? ` transform="rotate(${d.rot} ${d.x} ${d.y})"` : ""}>${d.text}</text>`;
      } else if (d.solid) {
        lines += `<${d.t} class="f" style="--i:${i++}" ${attrs(d.a)} fill="${d.solid === true ? p.line : d.solid}"/>`;
      } else {
        lines += `<${d.t} class="l" pathLength="1" ${attrs(d.a)} style="--i:${i++};stroke:${d.stroke || p.line}"/>`;
      }
    }
    return `<span class="art" aria-hidden="true">
      <svg class="fills" viewBox="${box}" filter="url(#acrylic)"><g transform="translate(-1.2 1.4)">${fills}</g></svg>
      <svg class="lines" viewBox="${box}" filter="url(#pen)">${lines}</svg></span>`;
  }

  window.MiniPrint = { NYC_PRINTS, artSVG };
})();
