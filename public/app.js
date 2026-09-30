(() => {
  const { NYC_PRINTS, artSVG } = window.MiniPrint;

  // The hand-drawn New York set is only a stand-in for local previews (no server). The live site never shows it:
  // before a city loads it shows six blank "?" stickers, and a print that can't be drawn is refunded instead.
  const DEV = ["localhost", "127.0.0.1"].includes(location.hostname);
  const LOCAL = { key: "local-nyc", edition: "New York City", remote: false, prints: NYC_PRINTS };
  const BLANK = { key: "blank", edition: "Your city", remote: false, blank: true,
                  prints: [1, 2, 3, 4, 5, 6].map((n) => ({ id: `blank-${n}`, title: "", where: "" })) };
  let SET = DEV ? LOCAL : BLANK;

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, RM ? Math.min(ms, 60) : ms));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Wait for an image to be ready to paint, but never hang the print on it.
  const decoded = (img) => Promise.race([img.decode().catch(() => {}), sleep(1500)]);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const load = (k, d) => { try { const v = localStorage.getItem("npm-" + k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem("npm-" + k, JSON.stringify(v)); } catch {} };
  const statusEl = $("status");
  const say = (html) => { statusEl.innerHTML = html; };
  if (RM) document.querySelectorAll("animate.boil").forEach((a) => a.remove());

  // A print is either hand-drawn (has `shapes`) or generated (has `image` once it exists).
  // where: "lineup" (the machine's stickers), "tile" (stash), or "card" (the print being pulled or viewed).
  function artFor(p, where) {
    if (p.shapes) return artSVG(p, where === "lineup" ? "20 18 80 80" : undefined);
    if (where === "card" && p.layers?.length) {
      const off = () => (Math.random() * 3 - 1.5).toFixed(1); // misregistration, a pixel or two per ink
      return `<span class="art photo layers" aria-hidden="true">${p.layers.map((l, k) =>
        `<img src="${esc(l.url)}" alt="" decoding="async" style="--dx:${k ? off() : 0}px;--dy:${k ? off() : 0}px">`).join("")}</span>`;
    }
    const src = where === "lineup" ? p.thumb || p.image : p.image;
    if (src) return `<span class="art photo" aria-hidden="true"><img class="fills" src="${esc(src)}" alt="" decoding="async"></span>`;
    return `<span class="art pending" aria-hidden="true"><span>${where === "card" ? "inking…" : "?"}</span></span>`;
  }

  const coinSVG = `<svg class="coin" viewBox="0 0 40 40" aria-hidden="true"><g filter="url(#crayon-line)">
    <circle cx="20" cy="20" r="18" fill="#DADCE8" stroke="#6C7399" stroke-width="2.2" stroke-dasharray="1.4 1.6"/>
    <circle cx="20" cy="20" r="18" fill="url(#hatch)"/>
    <circle cx="20" cy="20" r="13.5" fill="none" stroke="#9EA3C2" stroke-width="1.3"/>
    <text x="20" y="24.5" text-anchor="middle" font-size="12" font-family="Londrina Solid, sans-serif" font-weight="900" fill="#6C7399">25¢</text></g></svg>`;

  // ---------- sound ----------
  const sfx = (() => {
    let ctx, buf, on = load("sound", true);
    const ac = () => {
      if (!on) return null;
      try { ctx ||= new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    };
    const tone = (f, d, type, g, delay = 0, to) => {
      const a = ac(); if (!a) return;
      const t = a.currentTime + delay, o = a.createOscillator(), v = a.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
      v.gain.setValueAtTime(.0001, t); v.gain.exponentialRampToValueAtTime(g, t + .006); v.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(v).connect(a.destination); o.start(t); o.stop(t + d + .03);
    };
    const noise = (d, g, freq, type = "bandpass", delay = 0) => {
      const a = ac(); if (!a) return;
      if (!buf) { buf = a.createBuffer(1, a.sampleRate, a.sampleRate); const ch = buf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
      const t = a.currentTime + delay, s = a.createBufferSource(), f = a.createBiquadFilter(), v = a.createGain();
      s.buffer = buf; f.type = type; f.frequency.value = freq;
      v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(.0001, t + d);
      s.connect(f).connect(v).connect(a.destination); s.start(t); s.stop(t + d);
    };
    return {
      clink() { tone(2500, .3, "sine", .09); tone(3800, .22, "sine", .05, .004); noise(.04, .12, 5000, "highpass"); },
      tick() { noise(.05, .22, 1800); tone(900, .03, "square", .02); },
      slide() { noise(.25, .18, 900, "lowpass"); },
      clunk() { tone(170, .28, "square", .05, 0, 60); noise(.14, .3, 400, "lowpass"); [0, .05, .1, .16].forEach((d) => tone(2200 + Math.random() * 900, .12, "sine", .03, .12 + d)); },
      swish() { noise(.4, .1, 2600); },
      roll() { noise(.95, .07, 500, "lowpass"); },
      chime() { [784, 988, 1318].forEach((f, i) => tone(f, .6, "triangle", .07, i * .09)); },
      // Browsers keep audio muted until the visitor interacts; call this from a click/tap/key handler.
      unlock() {
        if (!on) return;
        try { ctx ||= new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
        if (ctx.state !== "running") ctx.resume().catch(() => {});
      },
      get on() { return on; }, set on(v) { on = v; save("sound", v); }
    };
  })();
  // The first click, tap or key press anywhere unlocks sound, even mid-spin, so the ticking joins right in.
  for (const type of ["pointerdown", "keydown", "touchstart"]) {
    addEventListener(type, () => sfx.unlock(), { capture: true, passive: true });
  }

  const soundBtn = $("sound");
  const paintSound = () => {
    soundBtn.setAttribute("aria-pressed", sfx.on);
    soundBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z"/>${sfx.on ? '<path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>' : '<path d="M17 9l5 6M22 9l-5 6"/>'}</svg>sound ${sfx.on ? "on" : "off"}`;
  };
  soundBtn.addEventListener("click", () => { sfx.on = !sfx.on; paintSound(); });
  paintSound();

  // ---------- wobbly hand-lettered heading ----------
  const h1 = $("title");
  h1.innerHTML = h1.innerHTML.split("<br>").map((line) =>
    [...line].map((ch) => {
      if (ch === " ") return " ";
      const r = (Math.random() * 4 - 2).toFixed(1), y = (Math.random() * 2 - 1).toFixed(1);
      return `<span class="ch" aria-hidden="true" style="transform:translateY(${y}px) rotate(${r}deg);--r2:${-r}deg">${ch}</span>`;
    }).join("")
  ).join("<br>");

  // ---------- which city's machine is this ----------
  function paintMachine() {
    cityName.textContent = SET.edition;
    cityName.setAttribute("aria-label", `${SET.edition}. Change city`);
    document.title = `${SET.edition} Mini Print Machine`;
    paintLineup();
    paintStash();
    fitMachine();
  }

  // The machine has two layouts: tall (520px, stickers 2×3) and wide (600px, stickers 1×6), both taller than wide.
  // Measure both at full size, keep whichever can be shown bigger in this window, then scale it
  // as a whole so the rectangle always fits with 40px above and below. Wide must win by 4% to
  // avoid flip-flopping near the boundary.
  const machineEl = $("machine"), machineBody = machineEl.querySelector(".machine");
  const MAX_WIDTH_TO_HEIGHT = 0.8; // the machine is never wider than 80% of its height
  function fitMachine() {
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    machineEl.style.zoom = "";
    const scaleFor = (wide) => {
      machineEl.classList.toggle("wide", wide);
      machineBody.style.minHeight = "";
      machineBody.style.minHeight = `${Math.ceil(machineEl.offsetWidth / MAX_WIDTH_TO_HEIGHT)}px`;
      return Math.min(1, (vw - 32) / machineEl.offsetWidth, (vh - 80) / machineEl.offsetHeight);
    };
    const tall = scaleFor(false), wide = scaleFor(true);
    const useWide = wide > tall * 1.04;
    scaleFor(useWide); // re-apply the chosen layout and its height floor
    machineEl.style.zoom = (useWide ? wide : tall).toFixed(3);
  }
  addEventListener("resize", fitMachine);
  document.fonts?.ready.then(fitMachine);
  function paintLineup() {
    $("lineup").innerHTML = SET.prints.map((p, i) =>
      `<li style="--i:${i}"><span class="sr-only">${esc(p.title)}</span>${artFor(p, "lineup")}</li>`).join("");
  }

  // ---------- theme color: a new one for every city you travel to ----------
  const THEMES = [
    ["#E0312B", "#A91F1A"], // tomato red
    ["#2F5FD0", "#1F3F94"], // cobalt
    ["#1F9E7A", "#136B52"], // jade
    ["#F07A1A", "#B5530B"], // tangerine
    ["#D6457C", "#9C2A56"], // bubblegum
    ["#7A4FD1", "#56349A"], // violet
    ["#C99A12", "#8F6C06"], // mustard
  ];
  let themeIdx = Math.min(load("theme", 0), THEMES.length - 1);
  const showTheme = (i) => {
    document.documentElement.style.setProperty("--red", THEMES[i][0]);
    document.documentElement.style.setProperty("--red-deep", THEMES[i][1]);
  };
  const applyTheme = () => showTheme(themeIdx);
  function newTheme() {
    let next;
    do next = Math.floor(Math.random() * THEMES.length); while (next === themeIdx);
    themeIdx = next;
    save("theme", themeIdx);
    applyTheme();
  }
  applyTheme();

  // ---------- traveling to a city ----------
  // place: { city, country } picked from the list, or undefined to use the visitor's detected location.
  async function fetchSet(place) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    try {
      const qs = place ? `?city=${encodeURIComponent(place.city)}${place.country ? `&country=${place.country}` : ""}` : "";
      const r = await fetch("/api/set" + qs, { signal: ctrl.signal });
      if (r.status === 400) { // not on the supported list
        const j = await r.json().catch(() => ({}));
        throw Object.assign(new Error("unsupported"), { unsupported: true, detail: j.detail });
      }
      if (!r.ok) throw new Error(`set ${r.status}`);
      const data = await r.json();
      if (!Array.isArray(data.prints) || data.prints.length !== 6) throw new Error("bad set");
      return { key: data.key, edition: data.edition, remote: true, prints: data.prints };
    } finally {
      clearTimeout(timer);
    }
  }

  // While a city loads, the map slides, the stickers flip like reels and the edition name flicks through
  // place names. The six stickers are all drawn up front, in parallel; then everything lands at once.
  let flipping = false, flapTimer = null;
  // Each sticker flips top-over like a reel; the picture changes exactly when it's edge-on (invisible),
  // and always to a different one, so it reads as flipping through random pictures.
  // `faces` is a function so the flip always draws from the latest pool (it may arrive mid-spin).
  async function flipCard(li, facesNow, delay) {
    await sleep(delay);
    const half = RM ? 1 : 28; // ~60ms per flip: too fast to follow, reads as a blur of pictures
    let current = -1;
    while (flipping) {
      await Promise.race([li.animate([{ transform: "rotateX(0deg)" }, { transform: "rotateX(90deg)" }], { duration: half, easing: "linear" }).finished, sleep(half + 40)]);
      const faces = facesNow();
      let next;
      do next = (Math.random() * faces.length) | 0; while (next === current && faces.length > 1);
      current = next;
      li.innerHTML = faces[next];
      await Promise.race([li.animate([{ transform: "rotateX(-90deg)" }, { transform: "rotateX(0deg)" }], { duration: half, easing: "linear" }).finished, sleep(half + 40)]);
    }
  }
  // Stickers from every city drawn so far, preloaded so they show instantly while the machine spins.
  let reelFaces = [];
  const reelReady = fetch("/api/reel").then((r) => (r.ok ? r.json() : { faces: [] })).then(({ faces }) => {
    reelFaces = (faces || []).map((url) => { new Image().src = url; return artFor({ image: url, thumb: url }, "lineup"); });
  }).catch(() => {});
  let colorTimer = null;
  function startSpin(cycleColors) {
    machineEl.classList.add("traveling");
    if (cycleColors) { // flick through theme colors until the new city lands on its own
      document.documentElement.classList.add("theme-cycling");
      let shown = themeIdx;
      colorTimer = setInterval(() => {
        let n;
        do n = (Math.random() * THEMES.length) | 0; while (n === shown);
        shown = n;
        showTheme(n);
      }, 170);
    }
    window.MiniPrintMap?.travel(true);
    const fallback = [...new Set([...SET.prints, ...(DEV ? LOCAL.prints : [])].map((p) => artFor(p, "lineup")))];
    const faces = () => (reelFaces.length >= 8 ? reelFaces : fallback); // switches to the saved pool the moment it arrives
    flipping = true;
    $("lineup").querySelectorAll("li").forEach((li, i) => flipCard(li, faces, i * 45));
    let frameNo = 0;
    flapTimer = setInterval(() => {
      if (cityNames.length) cityName.textContent = cityNames[(Math.random() * cityNames.length) | 0];
      if (frameNo++ % 2 === 0) sfx.tick();
    }, 120);
  }
  function stopSpin() {
    flipping = false;
    clearInterval(flapTimer);
    clearInterval(colorTimer);
    document.documentElement.classList.remove("theme-cycling");
    machineEl.classList.remove("traveling");
    window.MiniPrintMap?.travel(false);
  }

  // Minutes until the hourly allowance of new drawings refills, for the friendly "out of ink" note.
  // One friendly message for every limit (per-visitor hourly, or the site's daily budget).
  const untilText = (resetAt) => {
    const min = Math.max(1, Math.ceil(((resetAt || Date.now() + 3600e3) - Date.now()) / 60000));
    return min < 90 ? `${min} min` : `${Math.round(min / 60)} hr`;
  };
  const outOfInk = (resetAt) => `The printer's out of ink for now ✶ it'll be ready again in about ${untilText(resetAt)}.`;

  // Would this trip need more new drawings than the visitor has left this hour? Cities that are already drawn
  // are always fine; unknown answers (a network hiccup) let the trip go ahead.
  async function tripBlocked(place) {
    try {
      const qs = place ? `?city=${encodeURIComponent(place.city)}${place.country ? `&country=${place.country}` : ""}&peek=1` : "?peek=1";
      const [peek, quota] = await Promise.all([fetch("/api/set" + qs), fetch("/api/quota").then((r) => r.json())]);
      let needed = 6;
      if (peek.ok) needed = (await peek.json()).prints.filter((p) => !p.image).length;
      if (!needed || quota.remaining == null) return null;
      return quota.remaining < needed ? quota : null;
    } catch {
      return null;
    }
  }

  async function travel(place, { switching, first = false }) {
    if (busy) return;
    // Trips and arrivals alike: if the city isn't drawn yet and there isn't enough ink left to draw it, don't go.
    const blocked = await tripBlocked(place);
    if (blocked) {
      cityName.textContent = SET.edition; // stay put: no spin, no map, no color change
      say(outOfInk(blocked.resetAt));
      return;
    }
    busy = true;
    slotEls.forEach((s) => s.setAttribute("aria-disabled", "true"));
    if (first) await Promise.race([reelReady, sleep(1000)]); // so the first spin flips through saved stickers, not placeholders
    const started = Date.now();
    say(place ? `Traveling to ${esc(place.city)}…` : "Finding where you are…");
    startSpin(switching);

    let next = null, problem = null, limitedAt = null;
    try {
      next = await fetchSet(place);
      const missing = next.prints.filter((p) => !p.image);
      let ready = 6 - missing.length;
      const progress = () => say(`Drawing ${esc(next.edition)}… <b>${ready} of 6</b>`);
      if (missing.length) {
        progress();
        await Promise.race([
          Promise.allSettled(missing.map((p) => ensureImage(next, p).then(() => { ready++; progress(); })))
            .then((results) => { limitedAt = results.find((r) => r.reason?.limited)?.reason; }),
          sleep(170000), // never spin forever; anything unfinished is drawn when it's first pulled
        ]);
      }
    } catch (err) {
      problem = err;
    }

    const minSpin = (first ? 2400 : 1400) - (Date.now() - started); // even a cached city gets a proper spin
    if (minSpin > 0) await sleep(minSpin);
    stopSpin();

    if (next) {
      if (switching) newTheme(); // lands on a color different from the one we left
      else applyTheme();
      SET = next;
      say(limitedAt ? outOfInk(limitedAt.resetAt) : "Pick a slot to start.");
      sfx.chime();
    } else {
      applyTheme(); // the trip didn't happen: back to the color we had
      if (problem?.unsupported) {
        say(esc(problem.detail || "We don't print for that place yet."));
      } else {
        console.warn("Couldn't load a set:", problem);
        if (place) say(SET.blank ? `Couldn't reach ${esc(place.city)} right now ✶ try again in a moment.`
                                 : `Couldn't reach ${esc(place.city)} right now. Staying in ${esc(SET.edition)}.`);
      }
    }
    paintMachine();
    const lineup = $("lineup");
    lineup.classList.add("landed");
    setTimeout(() => lineup.classList.remove("landed"), 1500);
    busy = false;
    slotEls.forEach((s) => s.removeAttribute("aria-disabled"));
  }

  // ---------- picking a city: type over the edition name ----------
  const cityName = $("city-name"), cityInput = $("city-input"), cityList = $("city-list");
  let citiesData = null, options = [], sel = -1;
  function placeCityList() {
    if (cityList.hidden) return;
    // The line is tilted -2°, so the input's lowest point is its bottom-left corner: hang the list from there.
    const r = cityInput.getBoundingClientRect();
    cityList.style.left = `${r.left}px`;
    cityList.style.top = `${r.bottom + 4}px`;
  }
  addEventListener("resize", placeCityList);
  addEventListener("scroll", placeCityList, { passive: true });
  let cityNames = [];
  const loadCities = () => (citiesData ||= fetch("/cities.json").then((r) => r.json()).then((d) => {
    if (d) cityNames = d.cities.map(([c]) => c);
    return d;
  }).catch(() => null));
  const norm = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  function searchCities(q, data) {
    const n = norm(q);
    if (!n || !data) return [];
    const alias = data.aliases[n];
    const scored = [];
    for (const [city, cc, region] of data.cities) {
      const c = norm(city), country = data.countries[cc] || cc;
      let score = alias && c === norm(alias) ? -1
        : c.startsWith(n) ? 0
        : c.split(" ").some((w) => w.startsWith(n)) ? 1
        : c.includes(n) ? 2
        : norm(country).startsWith(n) ? 3 : null;
      if (score !== null) scored.push({ city, cc, sub: cc === "US" && region ? `${region}, USA` : country, score });
    }
    return scored.sort((a, b) => a.score - b.score || a.city.localeCompare(b.city)).slice(0, 8);
  }

  // Grow the input to fit whatever it shows, so it sits in the line like the name it replaced.
  const measurer = document.createElement("canvas").getContext("2d");
  function sizeCityInput() {
    const cs = getComputedStyle(cityInput);
    measurer.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const text = (cityInput.value || cityInput.placeholder).toUpperCase();
    const spacing = parseFloat(cs.letterSpacing) || 0;
    cityInput.style.width = Math.ceil(measurer.measureText(text).width + spacing * text.length + 6) + "px";
  }

  function highlight(city, q) {
    const i = norm(city).indexOf(norm(q));
    if (i < 0 || norm(city).length !== city.length) return esc(city); // skip marking names with accents/punctuation shifts
    return esc(city.slice(0, i)) + `<mark>${esc(city.slice(i, i + norm(q).length))}</mark>` + esc(city.slice(i + norm(q).length));
  }

  async function renderCityList() {
    const q = cityInput.value;
    if (!q.trim()) {
      options = [{ here: true }];
    } else {
      options = searchCities(q, await loadCities());
      if (cityInput.value !== q) return; // a newer keystroke already rendered
    }
    sel = q.trim() && options.length ? 0 : -1;
    cityList.innerHTML = options.length
      ? options.map((o, i) => o.here
          ? `<li id="city-opt-${i}" role="option" class="here" data-i="${i}">Use my location</li>`
          : `<li id="city-opt-${i}" role="option" data-i="${i}"><span>${highlight(o.city, q)}</span><small>${esc(o.sub)}</small></li>`).join("")
      : `<li class="none" aria-disabled="true">We don't print there yet</li>`;
    markSelected();
    cityList.hidden = false;
    placeCityList();
    cityInput.setAttribute("aria-expanded", "true");
  }
  function markSelected() {
    cityList.querySelectorAll("[role=option]").forEach((li) => li.setAttribute("aria-selected", String(+li.dataset.i === sel)));
    if (sel >= 0) { cityInput.setAttribute("aria-activedescendant", `city-opt-${sel}`); $(`city-opt-${sel}`)?.scrollIntoView({ block: "nearest" }); }
    else cityInput.removeAttribute("aria-activedescendant");
  }

  function openCityEditor() {
    if (busy) return;
    cityInput.placeholder = cityName.textContent;
    cityInput.value = "";
    cityName.hidden = true;
    cityInput.hidden = false;
    sizeCityInput();
    cityInput.focus();
    loadCities();
    renderCityList();
  }
  function closeCityEditor() {
    cityInput.hidden = true;
    cityName.hidden = false;
    cityList.hidden = true;
    cityInput.setAttribute("aria-expanded", "false");
  }
  function chooseCity(o) {
    closeCityEditor();
    cityName.focus();
    if (o.here) { save("place", null); travel(undefined, { switching: true }); return; }
    const place = { city: o.city, country: o.cc };
    save("place", place);
    travel(place, { switching: true });
  }

  cityName.addEventListener("click", openCityEditor);
  cityInput.addEventListener("input", () => { sizeCityInput(); placeCityList(); renderCityList(); });
  cityInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!options.length) return;
      sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      markSelected();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = options[sel >= 0 ? sel : 0];
      if (o) chooseCity(o);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      closeCityEditor();
      cityName.focus();
    }
  });
  cityInput.addEventListener("blur", () => setTimeout(() => { if (document.activeElement !== cityInput) closeCityEditor(); }, 150));
  cityList.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus in the input while clicking
  cityList.addEventListener("click", (e) => {
    const li = e.target.closest("[role=option]");
    if (li) chooseCity(options[+li.dataset.i]);
  });

  // ---------- stash: every place you've collected from, one envelope each ----------
  // Prints live under "stash:<city key>" ({ id: { n, title, where, image, thumb, layers } }); an index
  // ("stashIndex": { key: { edition, ids, theme, updated } }) remembers each place's name, its six print ids
  // (to know a full set) and the machine color it had when you were there (the envelope's stamp).
  const stashKey = (setKey) => (setKey === LOCAL.key ? "stash" : `stash:${setKey}`);
  const getStash = (setKey) => load(stashKey(setKey), {});
  function stashIndex() {
    const idx = load("stashIndex", null) || {};
    if (DEV && !idx[LOCAL.key] && Object.keys(getStash(LOCAL.key)).length) { // carry over older saves
      idx[LOCAL.key] = { edition: LOCAL.edition, ids: LOCAL.prints.map((x) => x.id), theme: 0, updated: 0 };
    }
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const m = k && k.match(/^npm-stash:(.+)$/);
        if (m && !idx[m[1]]) {
          const name = m[1].split("--")[0].split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
          idx[m[1]] = { edition: name, ids: Object.keys(getStash(m[1])), theme: 0, updated: 0 };
        }
      }
    } catch {}
    return idx;
  }
  function recordPrint(set, p) {
    const st = getStash(set.key);
    const prev = st[p.id] || { n: 0 };
    st[p.id] = { n: prev.n + 1, title: p.title, where: p.where, image: p.image || prev.image || null,
                 thumb: p.thumb || prev.thumb || null, layers: p.layers || prev.layers || null };
    save(stashKey(set.key), st);
    const idx = stashIndex();
    idx[set.key] = { edition: set.edition, ids: set.prints.map((x) => x.id), theme: idx[set.key]?.theme ?? themeIdx, updated: Date.now() };
    save("stashIndex", idx);
  }

  const openEnvelopes = new Set();
  function paintStash() {
    const idx = stashIndex();
    const places = Object.entries(idx)
      .map(([key, meta]) => ({ key, ...meta, got: meta.ids.filter((id) => getStash(key)[id]) }))
      .filter((pl) => pl.got.length && (DEV || pl.key !== LOCAL.key)) // hand-drawn stand-ins never show on the live site
      .sort((a, b) => b.updated - a.updated);
    const total = places.reduce((n, pl) => n + pl.got.length, 0);
    $("tally").innerHTML = total
      ? `<b>${total}</b> print${total === 1 ? "" : "s"} from <b>${places.length}</b> place${places.length === 1 ? "" : "s"}`
      : "Nothing yet. Feed the machine.";
    $("envelopes").innerHTML = places.map((pl) => {
      const st = getStash(pl.key), full = pl.got.length === pl.ids.length;
      const color = THEMES[pl.theme ?? 0] || THEMES[0];
      const cards = pl.got.map((id, k) => {
        const e = st[id], local = pl.key === LOCAL.key ? LOCAL.prints.find((x) => x.id === id) : null;
        const pr = local ? local : { ...e };
        return `<button class="env-card" type="button" data-key="${esc(pl.key)}" data-id="${esc(id)}" style="--k:${k - (pl.got.length - 1) / 2};--k2:${(k - (pl.got.length - 1) / 2) ** 2}" aria-label="View ${esc(e.title)}" tabindex="-1">
          <span class="mini${pr.shapes ? "" : " has-photo"}">${artFor(pr, "tile")}<span class="pencil"><span class="t">${esc(e.title || pr.title)}</span><span class="where">${esc(e.where || pr.where)}</span></span></span></button>`;
      }).join("");
      return `<div class="env-item${openEnvelopes.has(pl.key) ? " open" : ""}" data-key="${esc(pl.key)}" style="--stamp:${color[0]};--stamp-deep:${color[1]}">
        <div class="env">
          <div class="env-flap" aria-hidden="true"></div>
          <div class="env-cards">${cards}</div>
          <div class="env-pocket" aria-hidden="true"></div>
          <button class="env-body" type="button" aria-expanded="${openEnvelopes.has(pl.key)}" aria-label="${esc(pl.edition)}: ${pl.got.length} of ${pl.ids.length} prints${full ? ", full set" : ""}. ${openEnvelopes.has(pl.key) ? "Close" : "Open"} envelope"></button>
          <div class="env-face" aria-hidden="true">
            <span class="env-name">${esc(pl.edition)}</span>
            <span class="env-count">${full ? "full set" : `${pl.got.length} of ${pl.ids.length}`}</span>
            <span class="env-stamp">${full ? "✶" : ""}</span>
          </div>
        </div>
      </div>`;
    }).join("");
    $("envelopes").querySelectorAll(".env-item.open .env-card").forEach((c) => c.removeAttribute("tabindex"));
  }
  $("envelopes").addEventListener("click", (e) => {
    const body = e.target.closest(".env-body");
    if (body) {
      const item = body.closest(".env-item"), key = item.dataset.key;
      const open = !item.classList.contains("open");
      const setOpen = (it, on) => {
        it.classList.toggle("open", on);
        it.querySelector(".env-body").setAttribute("aria-expanded", String(on));
        it.querySelectorAll(".env-card").forEach((c) => (on ? c.removeAttribute("tabindex") : c.setAttribute("tabindex", "-1")));
        on ? openEnvelopes.add(it.dataset.key) : openEnvelopes.delete(it.dataset.key);
      };
      if (open) $("envelopes").querySelectorAll(".env-item.open").forEach((other) => setOpen(other, false)); // one open at a time
      setOpen(item, open);
      sfx.slide();
      return;
    }
    const card = e.target.closest(".env-card");
    if (!card || busy) return;
    const { key, id } = card.dataset;
    const entry = getStash(key)[id];
    const local = key === LOCAL.key ? LOCAL.prints.find((x) => x.id === id) : null;
    showPrint(local ? { ...local } : { id, ...entry }, { instant: true, set: SET, fromEl: card.querySelector(".mini") });
  });

  // ---------- slots ----------
  const NEED = 4;
  const coins = [0, 0, 0];
  let active = null, busy = false;
  const slotsEl = $("slots");
  slotsEl.innerHTML = [0, 1, 2].map((i) => `
    <button class="slot" type="button" data-i="${i}" aria-label="Coin slot ${i + 1}, one dollar. Tap to pull it open.">
      <span class="slot-shade" aria-hidden="true"></span>
      <span class="cover"></span>
      <span class="window">
        <span class="bed"><span class="wells">${'<span class="well"></span>'.repeat(NEED)}</span></span>
        <span class="lip"><span class="price">$1.00</span></span>
      </span>
    </button>`).join("");
  const slotEls = [...slotsEl.children];

  function paintSlot(i) {
    const el = slotEls[i], n = coins[i], open = active === i;
    el.classList.toggle("ready", open && n >= NEED);
    el.setAttribute("aria-label",
      !open ? `Coin slot ${i + 1}, one dollar. Tap to pull it open.` :
      n < NEED ? `Coin slot ${i + 1} is open with ${n} of 4 quarters. Tap to drop a quarter.` :
      `Coin slot ${i + 1} holds a dollar. Tap to push it in.`);
  }
  function openSlot(i) {
    active = i;
    slotEls[i].classList.add("open");
    sfx.slide();
    paintSlot(i);
    say("Tap the tray to drop in a quarter. <b>0 of 4</b>");
  }
  function closeSlot(i, refund) {
    const el = slotEls[i];
    if (refund && coins[i]) {
      el.querySelectorAll(".well .coin").forEach((c, k) => { c.classList.add("out"); setTimeout(sfx.clink, k * 70); });
      setTimeout(() => el.querySelectorAll(".well").forEach((w) => (w.innerHTML = "")), 450);
      coins[i] = 0;
    }
    el.classList.remove("open", "ready");
    if (active === i) active = null;
    paintSlot(i);
  }
  function dropCoin(i) {
    const k = coins[i]++;
    const well = slotEls[i].querySelectorAll(".well")[k];
    const r = well.getBoundingClientRect();
    const fly = document.createElement("div");
    fly.className = "fly-coin";
    Object.assign(fly.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    fly.innerHTML = coinSVG;
    document.body.appendChild(fly);
    const dur = RM ? 1 : 620;
    fly.animate([
      { transform: "translateY(-130px) rotateX(0deg) scale(1.15)", opacity: 0 },
      { opacity: 1, offset: .15 },
      { transform: "translateY(0) rotateX(900deg) scale(1)", offset: .72 },
      { transform: "translateY(-9px) rotateX(900deg) scale(1)", offset: .86 },
      { transform: "translateY(0) rotateX(900deg) scale(1)", opacity: 1 }
    ], { duration: dur, easing: "cubic-bezier(.45,0,.6,1)" }).onfinish = () => {
      fly.remove();
      if (active !== i) return;
      well.innerHTML = coinSVG;
    };
    setTimeout(sfx.clink, dur * .7);
    paintSlot(i);
    if (coins[i] >= NEED) say("That's a dollar! <b>Tap the slot to push it in.</b>");
    else say(`Tap the tray to drop in a quarter. <b>${coins[i]} of 4</b>`);
  }

  async function pushIn(i) {
    if (SET.blank) { // no city loaded yet (live site): hand the quarters back
      closeSlot(i, true);
      say("The machine's still finding its city ✶ tap the edition name to pick one.");
      return;
    }
    busy = true;
    slotEls.forEach((s) => s.setAttribute("aria-disabled", "true"));
    closeSlot(i, false);
    coins[i] = 0;
    sfx.clunk();
    say("Clunk. Printing your surprise…");

    // Start generating (or fetching) the image right away; the feed-and-open animation covers the wait.
    const set = SET;
    const pickedId = pick(set); // pick once; the print is a surprise, but only one surprise per dollar
    const p = { ...set.prints.find((x) => x.id === pickedId) };
    const ready = ensureImage(set, p);
    ready.catch(() => {});

    const m = $("machine");
    m.classList.remove("rumble"); void m.offsetWidth; m.classList.add("rumble");
    await wait(900);
    slotEls[i].querySelectorAll(".well").forEach((w) => (w.innerHTML = ""));
    paintSlot(i);
    await showPrint(p, { instant: false, set, ready });
  }

  slotsEl.addEventListener("click", (e) => {
    const el = e.target.closest(".slot");
    if (!el || busy) return;
    const i = +el.dataset.i;
    if (active !== null && active !== i) {
      const had = coins[active];
      closeSlot(active, true);
      openSlot(i);
      if (had) say("Changed your mind? Quarters returned. <b>0 of 4</b>");
      return;
    }
    if (active !== i) return openSlot(i);
    if (coins[i] < NEED) return dropCoin(i);
    pushIn(i);
  });

  // ---------- getting a generated image ----------
  async function ensureImage(set, p) {
    if (!set.remote || p.shapes || p.image) return p;
    const deadline = Date.now() + 170000;
    while (Date.now() < deadline) {
      const r = await fetch("/api/print", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: set.key, id: p.id }),
      });
      if (r.status === 200) {
        const { image, thumb, layers } = await r.json();
        Object.assign(p, { image, thumb, layers });
        const orig = set.prints.find((x) => x.id === p.id);
        if (orig) Object.assign(orig, { image, thumb, layers });
        if (set === SET) paintLineup();
        // Warm the ink layers so the first brayer pass doesn't reveal a half-loaded image.
        await Promise.all((layers || [{ url: image }]).map(({ url }) => { const img = new Image(); img.src = url; return decoded(img); }));
        return p;
      }
      if (r.status === 202) { await sleep(3000); continue; }
      if (r.status === 503) {
        const j = await r.json().catch(() => ({}));
        if (j.status === "busy") { await sleep(6000); continue; } // the image service is catching up
        if (j.status === "limited") throw Object.assign(new Error("limited"), { limited: true, resetAt: j.resetAt });
      }
      if (r.status === 429) {
        const j = await r.json().catch(() => ({}));
        throw Object.assign(new Error("limited"), { limited: true, resetAt: j.resetAt });
      }
      throw new Error(`print ${r.status}`);
    }
    throw new Error("print timed out");
  }

  // ---------- the print ----------
  function pick(set) {
    // still a surprise, but prints you don't have yet are a bit more likely
    const st = getStash(set.key);
    const w = set.prints.map((p) => (st[p.id] ? 1 : 2.2));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let k = 0; k < set.prints.length; k++) if ((r -= w[k]) < 0) return set.prints[k].id;
    return set.prints[0].id;
  }

  const overlay = $("overlay"), mouth = $("mouth"), card = $("card"), inside = $("inside"), actions = $("actions");
  const OPEN_T = "translate(0, 34px) rotate(0deg) scale(1)";
  // Let the browser apply the new starting styles before we change them, so transitions run.
  // (A forced layout + short timer, not requestAnimationFrame, which is paused in background tabs.)
  const frame = () => new Promise((r) => { void document.body.offsetWidth; setTimeout(r, 30); });
  function putOnCard(p) {
    $("art-slot").innerHTML = artFor(p, "card");
    $("p-title").textContent = p.title;
    $("p-where").textContent = p.where;
    inside.classList.toggle("has-photo", !p.shapes);
    inside.setAttribute("aria-label", `${p.title}, ${p.where}`);
  }

  // Grow a card from `fromEl` (a print in the stash) to where it sits in the viewer, or back again.
  // Classic FLIP: measure both boxes, then animate the transform between them.
  let viewFrom = null;
  // The stash print is tilted in its fan, so match its real size, center and angle (its bounding box would be
  // a bit larger than the print and make the animation end with a small jump).
  function morph(fromEl, reverse) {
    const a = fromEl.getBoundingClientRect(), b = card.getBoundingClientRect();
    const tilt = fromEl.closest(".env-card");
    const m = new DOMMatrixReadOnly(tilt ? getComputedStyle(tilt).transform : "none");
    const angle = Math.atan2(m.b, m.a);
    const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
    const shrunk = `translate(${dx}px, ${dy}px) rotate(${angle}rad) scale(${fromEl.offsetWidth / b.width}, ${fromEl.offsetHeight / b.height})`;
    const frames = [{ transform: shrunk, transformOrigin: "50% 50%" }, { transform: "none", transformOrigin: "50% 50%" }];
    const duration = reverse ? 360 : 460;
    const anim = card.animate(reverse ? frames.reverse() : frames, { duration, easing: "cubic-bezier(.2,.85,.25,1)", fill: reverse ? "forwards" : "none" });
    return Promise.race([anim.finished, sleep(duration + 150)]); // never let a stalled animation block closing
  }

  async function showPrint(p, { instant, set, ready, fromEl }) {
    busy = true;
    putOnCard(p);
    $("again").hidden = instant;

    inside.className = "face inside" + (p.shapes ? "" : " has-photo");
    actions.classList.remove("show");
    card.classList.remove("open");
    overlay.classList.toggle("instant", instant);
    overlay.classList.toggle("viewing", instant);
    mouth.classList.toggle("clip", !instant);
    card.style.transition = "none";
    card.style.transform = instant ? "none" : "translateY(-101%)";
    if (instant) card.classList.add("open");
    overlay.hidden = false;
    await frame();
    overlay.classList.add("show");

    if (instant) {
      inside.classList.add("inked", "rolled", "signed");
      actions.classList.add("show");
      if (fromEl && !RM) {
        viewFrom = fromEl;
        fromEl.style.visibility = "hidden"; // the print "leaves" the envelope while it's being viewed
        morph(fromEl, false);
      }
      overlay.focus();
      return;
    }

    await wait(400);
    for (let s = 1; s <= 7; s++) {
      card.style.transition = "transform 140ms cubic-bezier(.2,.8,.3,1)";
      card.style.transform = `translateY(${(-101 + s * 101 / 7).toFixed(2)}%)`;
      sfx.tick();
      await wait(210);
    }
    await wait(200);
    mouth.classList.remove("clip");
    card.style.transition = "transform 700ms cubic-bezier(.3,1.5,.5,1)";
    card.style.transform = "translate(0, 34px) rotate(-3deg) scale(1.06)";
    await wait(800);
    card.style.transition = "transform 950ms cubic-bezier(.5,0,.2,1)";
    card.style.transform = OPEN_T;
    card.classList.add("flipping", "open");
    sfx.swish();
    await wait(1000);
    card.classList.remove("flipping");

    // A brand-new print for this city may still be drawing; the card waits, open, with "inking…".
    let from = set, fellBack = false;
    if (ready) {
      try {
        p = await ready;
      } catch (err) {
        if (!DEV) { // live site: no stand-in print. The press "jams" and the dollar comes back.
          console.warn("Print couldn't be made; refunding:", err);
          overlay.classList.remove("show");
          await wait(300);
          overlay.hidden = true;
          busy = false;
          slotEls.forEach((s) => s.removeAttribute("aria-disabled"));
          say(err?.limited
            ? `${outOfInk(err.resetAt)} Your dollar's back.`
            : "The press jammed ✶ your dollar's back. Give it another try in a moment.");
          return;
        }
        console.warn("Falling back to a New York print:", err);
        from = LOCAL;
        const fallbackId = pick(LOCAL);
        p = { ...LOCAL.prints.find((x) => x.id === fallbackId) };
        fellBack = true;
      }
      putOnCard(p);
      await frame();
    }

    const brayer = inside.querySelector(".brayer");
    if (p.layers?.length) {
      // One pass of the brayer per ink, lightest first, each laying down its own color as it rolls.
      const imgs = [...inside.querySelectorAll(".art.layers img")];
      await Promise.all(imgs.map(decoded));
      const dur = RM ? 1 : 850, ease = "cubic-bezier(.55,.1,.45,.9)";
      for (let k = 0; k < imgs.length; k++) {
        brayer.style.setProperty("--ink", p.layers[k].ink);
        sfx.roll();
        brayer.animate([{ left: "-16%", opacity: 1 }, { opacity: 1, offset: .9 }, { left: "104%", opacity: 0 }], { duration: dur, easing: ease });
        imgs[k].animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)" }], { duration: dur, easing: ease, fill: "forwards" });
        await wait(dur + 200);
      }
      inside.classList.add("pulled");
    } else {
      brayer.style.removeProperty("--ink");
      inside.classList.add("inked");
      if (p.shapes) await wait(500 + p.details.length * 60);
      inside.classList.add("rolled");
      sfx.roll();
      await wait(1050);
    }
    inside.classList.add("signed");
    recordPrint(from, p);
    paintStash();
    await wait(1100);
    sfx.chime();
    actions.classList.add("show");
    $("again").focus();
    if (fellBack) say(`The ${esc(set.edition)} press is busy right now, so this one came from New York.`);
  }

  async function closeOverlay() {
    if (overlay.hidden || !actions.classList.contains("show")) return;
    overlay.classList.remove("show");
    if (viewFrom?.isConnected && overlay.classList.contains("viewing") && !RM) {
      await morph(viewFrom, true).catch(() => {}); // shrink back into its spot in the envelope
      viewFrom.style.visibility = "";
      card.getAnimations().forEach((an) => an.cancel());
    } else {
      if (viewFrom) viewFrom.style.visibility = "";
      await wait(300);
    }
    viewFrom = null;
    overlay.hidden = true;
    busy = false;
    slotEls.forEach((s) => s.removeAttribute("aria-disabled"));
    if (!statusEl.textContent.includes("came from New York")) say("Pick a slot for another surprise.");
  }
  $("close").addEventListener("click", closeOverlay);
  $("again").addEventListener("click", async () => { await closeOverlay(); slotEls[0].focus(); openSlot(0); });
  overlay.addEventListener("click", (e) => { if (e.target === overlay || overlay.classList.contains("viewing")) closeOverlay(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeOverlay(); });

  // ---------- start ----------
  paintMachine();                 // draw the New York machine immediately
  loadCities();
  const legacyCity = load("city", "");
  // Every arrival plays the full show: spin, colors cycling, then land on a fresh color. (Browsers keep sound off
  // until the visitor first clicks or taps, so this first spin is silent; every later one ticks and chimes.)
  travel(load("place", null) || (legacyCity ? { city: legacyCity } : undefined), { switching: true, first: true });
})();
