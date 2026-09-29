(() => {
  const { NYC_PRINTS, artSVG } = window.MiniPrint;

  // The built-in hand-drawn set. Used until the local set loads, and whenever the generator can't deliver.
  const LOCAL = { key: "local-nyc", edition: "New York City", remote: false, prints: NYC_PRINTS };
  let SET = LOCAL;

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, RM ? Math.min(ms, 60) : ms));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const load = (k, d) => { try { const v = localStorage.getItem("npm-" + k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem("npm-" + k, JSON.stringify(v)); } catch {} };
  const statusEl = $("status");
  const say = (html) => { statusEl.innerHTML = html; };
  if (RM) document.querySelectorAll("animate.boil").forEach((a) => a.remove());

  // A print is either hand-drawn (has `shapes`) or generated (has `image` once it exists).
  function artFor(p, where) {
    if (p.shapes) return artSVG(p, where === "lineup" ? "20 18 80 80" : undefined);
    if (p.image) return `<span class="art photo" aria-hidden="true"><img class="fills" src="${esc(p.image)}" alt="" decoding="async"></span>`;
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
      get on() { return on; }, set on(v) { on = v; save("sound", v); }
    };
  })();

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
  $("seal-coin").innerHTML = coinSVG;

  // ---------- which city's machine is this ----------
  function paintMachine() {
    $("edition-name").textContent = SET.edition;
    $("stamp").innerHTML = `Hand-pulled<br>in ${esc(SET.edition)}`;
    document.title = `${SET.edition} Mini Print Machine`;
    paintLineup();
    paintStash();
  }
  function paintLineup() {
    $("lineup").innerHTML = SET.prints.map((p, i) =>
      `<li style="--i:${i}" title="${esc(p.title)}">${artFor(p, "lineup")}<span class="tip">${esc(p.title)}</span></li>`).join("");
  }

  async function loadSet(city) {
    const edition = $("edition");
    edition.classList.add("loading");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    try {
      const r = await fetch("/api/set" + (city ? `?city=${encodeURIComponent(city)}` : ""), { signal: ctrl.signal });
      if (!r.ok) throw new Error(`set ${r.status}`);
      const data = await r.json();
      if (!Array.isArray(data.prints) || data.prints.length !== 6) throw new Error("bad set");
      SET = { key: data.key, edition: data.edition, remote: true, prints: data.prints };
      say("Pick a slot to start.");
    } catch (err) {
      console.warn("Using the built-in New York set:", err);
      SET = LOCAL;
      if (city) say(`Couldn't open a press for ${esc(city)} right now. Here's New York.`);
    } finally {
      clearTimeout(timer);
      edition.classList.remove("loading");
      paintMachine();
    }
  }

  const cityForm = $("city-form"), cityInput = $("city-input");
  $("edition-btn").addEventListener("click", () => {
    cityForm.hidden = !cityForm.hidden;
    if (!cityForm.hidden) { cityInput.value = load("city", ""); cityInput.focus(); }
  });
  cityForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const city = cityInput.value.trim();
    if (!city || busy) return;
    save("city", city);
    cityForm.hidden = true;
    loadSet(city);
  });
  $("city-auto").addEventListener("click", () => {
    if (busy) return;
    save("city", "");
    cityForm.hidden = true;
    loadSet();
  });

  // ---------- stash (one per city) ----------
  const stashKey = (setKey) => (setKey === LOCAL.key ? "stash" : `stash:${setKey}`);
  const getStash = (setKey) => load(stashKey(setKey), {});
  function recordPrint(set, p) {
    const st = getStash(set.key);
    const prev = st[p.id] || { n: 0 };
    st[p.id] = { n: prev.n + 1, title: p.title, where: p.where, image: p.image || prev.image || null };
    save(stashKey(set.key), st);
  }
  const tilts = [-2.5, 1.8, -1.2, 2.4, -1.8, 1.4];
  function paintStash() {
    const st = getStash(SET.key);
    const got = SET.prints.filter((p) => st[p.id]).length;
    $("tally").innerHTML = got ? `<b>${got}</b> of 6 collected` : "0 of 6 collected. Feed the machine.";
    $("stash").classList.toggle("complete", got === 6);
    $("tiles").innerHTML = SET.prints.map((p, i) => {
      const s = st[p.id];
      if (!s) return `<div class="tile empty" aria-label="Not collected yet"><div class="mini" style="--tilt:0deg"><span>?</span></div></div>`;
      return `<button class="tile" type="button" data-id="${esc(p.id)}" aria-label="View ${esc(p.title)}">
        <div class="mini" style="--tilt:${tilts[i]}deg">${artFor({ ...p, image: p.image || s.image }, "tile")}</div></button>`;
    }).join("");
  }
  $("tiles").addEventListener("click", (e) => {
    const t = e.target.closest("button.tile");
    if (!t || busy) return;
    const p = SET.prints.find((x) => x.id === t.dataset.id);
    const s = getStash(SET.key)[p.id];
    showPrint({ ...p, image: p.image || s?.image }, { instant: true, set: SET });
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
      <span class="count" aria-hidden="true">0/4</span>
    </button>`).join("");
  const slotEls = [...slotsEl.children];

  function paintSlot(i) {
    const el = slotEls[i], n = coins[i], open = active === i;
    el.querySelector(".count").textContent = `${n}/4`;
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
    busy = true;
    slotEls.forEach((s) => s.setAttribute("aria-disabled", "true"));
    closeSlot(i, false);
    coins[i] = 0;
    sfx.clunk();
    say("Clunk. Printing your surprise…");

    // Start generating (or fetching) the image right away; the feed-and-open animation covers the wait.
    const set = SET;
    const p = { ...set.prints.find((x) => x.id === pick(set)) };
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
        const { image } = await r.json();
        p.image = image;
        const orig = set.prints.find((x) => x.id === p.id);
        if (orig) orig.image = image;
        if (set === SET) paintLineup();
        const img = new Image();
        img.src = image;
        await img.decode().catch(() => {});
        return p;
      }
      if (r.status === 202) { await sleep(3000); continue; }
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
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  function putOnCard(p) {
    $("art-slot").innerHTML = artFor(p, "card");
    $("p-where").textContent = p.where;
    inside.classList.toggle("has-photo", !p.shapes);
    inside.setAttribute("aria-label", `${p.title}, ${p.where}`);
  }

  async function showPrint(p, { instant, set, ready }) {
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
    card.classList.add("open");
    sfx.swish();
    await wait(1000);

    // A brand-new print for this city may still be drawing; the card waits, open, with "inking…".
    let from = set, fellBack = false;
    if (ready) {
      try {
        p = await ready;
      } catch (err) {
        console.warn("Falling back to a New York print:", err);
        from = LOCAL;
        p = { ...LOCAL.prints.find((x) => x.id === pick(LOCAL)) };
        fellBack = true;
      }
      putOnCard(p);
      await frame();
    }

    inside.classList.add("inked");
    if (p.shapes) await wait(500 + p.details.length * 60);
    inside.classList.add("rolled");
    sfx.roll();
    await wait(1050);
    inside.classList.add("signed");
    recordPrint(from, p);
    if (from === SET) paintStash();
    await wait(1100);
    sfx.chime();
    actions.classList.add("show");
    $("again").focus();
    if (fellBack) say(`The ${esc(set.edition)} press is busy right now, so this one came from New York.`);
  }

  async function closeOverlay() {
    if (overlay.hidden || !actions.classList.contains("show")) return;
    overlay.classList.remove("show");
    await wait(300);
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
  loadSet(load("city", "") || undefined); // then swap in the visitor's own city
})();
