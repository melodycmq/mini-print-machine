// The city map behind everything: pale lines on muted navy, drawn once into a tile that wraps
// seamlessly left↔right so it can scroll forever while the machine "travels", then ease to a stop.
//
// How it's built (like a real city): the tile is split into neighborhoods (Voronoi cells). Each gets its own
// street grid at its own angle and spacing, or winding hill streets; major roads run along the neighborhood
// edges; a few long curving arterials sweep across; a meandering river cuts through with bridges; some
// blocks are parks. Everything is drawn with a little hand wobble and crayon grain.
(() => {
  const W = 1800, H = 1200;
  const INK = "42, 45, 94";             // navy line color, drawn on the pale page
  const RIVER = "rgba(42, 45, 94, 0.07)"; // a soft wash
  const PARK = `rgba(${INK}, 0.06)`;

  let seed = 1929;
  const rand = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const between = (a, b) => a + rand() * (b - a);

  function drawMap(dpr) {
    const c = document.createElement("canvas");
    c.width = W * dpr; c.height = H * dpr;
    const g = c.getContext("2d");
    g.scale(dpr, dpr);
    g.lineCap = "round"; g.lineJoin = "round";

    const stroke = (pts, width, alpha) => {
      g.strokeStyle = `rgba(${INK}, ${alpha})`;
      g.lineWidth = width;
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
    };
    // A slightly wobbly straight line (subdivided + nudged), like a steady hand with a pen.
    const segment = (x1, y1, x2, y2, width, alpha) => {
      const n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / 40)), pts = [];
      for (let i = 0; i <= n; i++) pts.push([x1 + ((x2 - x1) * i) / n + (i % n ? between(-0.7, 0.7) : 0), y1 + ((y2 - y1) * i) / n + (i % n ? between(-0.7, 0.7) : 0)]);
      stroke(pts, width, alpha);
    };
    // Draw something three times (shifted a tile left/right) so it continues across the wrap seam.
    const wrapped = (fn) => { for (const ox of [-W, 0, W]) { g.save(); g.translate(ox, 0); fn(); g.restore(); } };

    // ---- neighborhoods: Voronoi cells, computed with wrapped neighbors so the tile tiles ----
    const centers = [];
    for (let i = 0; i < 15; i++) centers.push({ x: between(0, W), y: between(0, H) });
    const all = centers.flatMap((p) => [p, { x: p.x - W, y: p.y }, { x: p.x + W, y: p.y }]);
    const clipHalf = (poly, a, b) => { // keep the side of the bisector of a–b nearest to a
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, nx = b.x - a.x, ny = b.y - a.y;
      const side = (p) => (p[0] - mx) * nx + (p[1] - my) * ny;
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q);
        if (sp <= 0) out.push(p);
        if ((sp < 0) !== (sq < 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
      }
      return out;
    };
    const cells = centers.map((cen) => {
      let poly = [[-W, -40], [2 * W, -40], [2 * W, H + 40], [-W, H + 40]];
      for (const o of all) if (o !== cen && Math.hypot(o.x - cen.x, o.y - cen.y) > 1) poly = clipHalf(poly, cen, o);
      return { cen, poly, kind: rand() < 0.18 ? "hills" : "grid", angle: between(-0.5, 0.5) + (rand() < 0.3 ? Math.PI / 4 : 0),
               sx: between(15, 26), sy: between(22, 48) };
    });
    const clipTo = (poly) => { g.beginPath(); poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.clip(); };

    // ---- streets inside each neighborhood ----
    for (const cell of cells) {
      wrapped(() => {
        g.save();
        clipTo(cell.poly);
        const { x: cx, y: cy } = cell.cen, R = 700;
        if (cell.kind === "grid") {
          const ca = Math.cos(cell.angle), sa = Math.sin(cell.angle);
          const at = (u, v) => [cx + u * ca - v * sa, cy + u * sa + v * ca];
          for (let u = -R; u <= R; u += cell.sx) { const [a, b] = [at(u, -R), at(u, R)]; segment(a[0], a[1], b[0], b[1], 0.8, 0.22); }
          for (let v = -R; v <= R; v += cell.sy) { const [a, b] = [at(-R, v), at(R, v)]; segment(a[0], a[1], b[0], b[1], 0.8, 0.22); }
          // an avenue or two through the neighborhood
          for (let k = 0; k < 2; k++) { const v = between(-160, 160); const [a, b] = [at(-R, v), at(R, v)]; segment(a[0], a[1], b[0], b[1], 1.4, 0.34); }
          if (rand() < 0.45) { const [a, b] = [at(-R, -R * 0.6), at(R, R * 0.6)]; segment(a[0], a[1], b[0], b[1], 1.4, 0.34); }
        } else {
          // hills: long winding streets that roughly follow contours, with a few switchbacks between them
          for (let y = cy - R / 2; y < cy + R / 2; y += between(16, 26)) {
            const ph = rand() * 6, amp = between(8, 22), pts = [];
            for (let x = cx - R; x <= cx + R; x += 14) pts.push([x, y + Math.sin(x / 55 + ph) * amp + Math.sin(x / 23 + ph * 2) * 4]);
            stroke(pts, 0.8, 0.22);
          }
          for (let k = 0; k < 10; k++) {
            const x = cx + between(-R / 2, R / 2), pts = [];
            for (let y = cy - R / 2; y < cy + R / 2; y += 18) pts.push([x + Math.sin(y / 40 + k) * 18, y]);
            stroke(pts, 0.7, 0.18);
          }
        }
        g.restore();
      });
    }

    // ---- parks: a few filled blocks ----
    g.fillStyle = PARK;
    for (let k = 0; k < 16; k++) {
      const cell = cells[(rand() * cells.length) | 0];
      const x = cell.cen.x + between(-90, 90), y = cell.cen.y + between(-90, 90), w = between(30, 110), h = between(24, 80), a = cell.angle;
      wrapped(() => {
        g.save(); g.translate(x, y); g.rotate(a);
        g.beginPath(); g.moveTo(-w / 2, -h / 2); g.lineTo(w / 2 + between(-8, 8), -h / 2); g.lineTo(w / 2, h / 2); g.lineTo(-w / 2 + between(-8, 8), h / 2); g.closePath();
        g.fill(); g.restore();
      });
    }

    // ---- major roads along neighborhood edges ----
    for (const cell of cells) {
      wrapped(() => {
        const pts = cell.poly.concat([cell.poly[0]]);
        for (let i = 0; i < pts.length - 1; i++) {
          const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
          if (rand() < 0.35) continue; // not every border is a boulevard
          segment(x1, y1, x2, y2, 2, 0.42);
        }
      });
    }

    // ---- long curving arterials (horizontal ones repeat exactly once per tile width) ----
    for (let k = 0; k < 3; k++) {
      const y0 = between(120, H - 120), a1 = between(40, 120), a2 = between(10, 40), ph = rand() * 6, pts = [];
      for (let x = -20; x <= W + 20; x += 12) pts.push([x, y0 + Math.sin((x / W) * Math.PI * 2 + ph) * a1 + Math.sin((x / W) * Math.PI * 6 + ph) * a2]);
      wrapped(() => stroke(pts, 2.6, 0.5));
    }
    // a ring road around one district
    const ring = cells[(rand() * cells.length) | 0].cen;
    wrapped(() => { const pts = []; for (let t = 0; t <= Math.PI * 2 + 0.05; t += 0.05) pts.push([ring.x + Math.cos(t) * 260 + Math.sin(t * 3) * 14, ring.y + Math.sin(t) * 190]); stroke(pts, 2.4, 0.46); });

    // ---- the river: meanders across, periodic in x, covers the streets under it ----
    const riverY = (x) => H * 0.62 + Math.sin((x / W) * Math.PI * 2 + 1) * 150 + Math.sin((x / W) * Math.PI * 6 + 2) * 40;
    const riverW = (x) => 46 + Math.sin((x / W) * Math.PI * 4) * 16;
    const edge = (sgn) => { const pts = []; for (let x = -20; x <= W + 20; x += 10) pts.push([x, riverY(x) + (sgn * riverW(x)) / 2]); return pts; };
    wrapped(() => {
      g.fillStyle = RIVER;
      g.beginPath();
      edge(-1).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      edge(1).reverse().forEach(([x, y]) => g.lineTo(x, y));
      g.closePath(); g.fill();
      stroke(edge(-1), 1.4, 0.34); stroke(edge(1), 1.4, 0.34);
      // an island
      const ix = W * 0.35, iy = riverY(ix);
      g.fillStyle = PARK; g.beginPath(); g.ellipse(ix, iy, 70, 9, 0.05, 0, Math.PI * 2); g.fill();
    });
    // bridges
    for (const bx of [0.12, 0.3, 0.47, 0.66, 0.84].map((f) => f * W)) {
      const y = riverY(bx), hw = riverW(bx) / 2 + 10, tilt = between(-14, 14);
      wrapped(() => { segment(bx - 3, y - hw, bx - 3 + tilt, y + hw, 1.6, 0.38); segment(bx + 3, y - hw, bx + 3 + tilt, y + hw, 1.6, 0.38); });
    }

    // ---- crayon grain: knock tiny gaps out of the lines ----
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = "rgba(0,0,0,0.35)";
    for (let i = 0; i < 30000; i++) g.fillRect(rand() * W, rand() * H, 1, 1);
    g.globalCompositeOperation = "source-over";
    return c;
  }

  // ---------- mount + motion ----------
  const map = document.createElement("div");
  map.className = "map";
  map.setAttribute("aria-hidden", "true");
  const track = document.createElement("div");
  track.className = "map-track";
  map.appendChild(track);
  document.body.prepend(map);

  // Prefer the painted map (public/map.webp, a mirrored seamless tile made by scripts/make-map.mjs),
  // scaled to the window's height so it never repeats vertically. Fall back to the drawn map if it's missing.
  let tileW = W;
  const useTile = (url, w, h) => {
    const fit = () => {
      const scale = Math.max(1, window.innerHeight / h);
      tileW = Math.round(w * scale);
      track.style.left = `-${tileW}px`;
      track.style.backgroundSize = `${tileW}px ${Math.round(h * scale)}px`;
    };
    track.style.backgroundImage = `url(${url})`;
    fit();
    addEventListener("resize", fit);
    map.classList.add("ready");
  };
  const painted = new Image();
  painted.onload = () => useTile(painted.src, painted.naturalWidth, painted.naturalHeight);
  painted.onerror = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    drawMap(dpr).toBlob((blob) => blob && useTile(URL.createObjectURL(blob), W, H));
  };
  painted.src = "/map.webp";

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const IDLE = 6, SPEED = 130; // px per second: a very slow drift at rest, a quick slide while traveling
  let x = 0, v = 0, target = 0, last = 0, running = false;
  function tick(now) {
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    v += (target - v) * Math.min(1, dt * 2.2);
    x = (x + v * dt) % tileW;
    track.style.transform = `translate3d(${x}px, 0, 0)`;
    requestAnimationFrame(tick);
  }

  if (!reduced) { target = IDLE; running = true; requestAnimationFrame(tick); } // start drifting right away

  window.MiniPrintMap = {
    travel(on) {
      if (reduced) return;
      target = on ? SPEED : IDLE;
      if (!running) { running = true; requestAnimationFrame(tick); }
    },
  };
})();
