// Runs /api/set end to end with Claude and Redis faked (no keys, no cost), so a broken import, a missing
// function or a bad prompt/schema wiring fails here instead of on the live site.   npm run smoke
process.env.ANTHROPIC_API_KEY ||= "test";
process.env.KV_REST_API_URL ||= "https://fake.upstash.io";
process.env.KV_REST_API_TOKEN ||= "test";

const fakeSet = {
  edition: "Testville",
  prints: ["a", "b", "c", "d", "e", "f"].map((id, i) => ({ id, title: `Thing ${i}`, kind: `thing${"abcdef"[i]}`, where: "Main St.", subject_zh: "一个“小”物件", inks: ["cobalt", "#ff00ff"] })),
};
let claudeRequest = null;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.includes("anthropic.com")) {
    claudeRequest = JSON.parse(init.body);
    return new Response(JSON.stringify({ id: "m", type: "message", role: "assistant", model: claudeRequest.model, stop_reason: "end_turn", stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text: JSON.stringify(fakeSet) }] }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (u.includes("upstash.io")) { // GET → nothing cached, SET → OK, pipelines → empty results
    const body = init.body ? JSON.parse(init.body) : [];
    const cmds = Array.isArray(body[0]) ? body : [body];
    const reply = (c) => { const op = String(c[0]).toLowerCase(); return op === "set" ? "OK" : op === "mget" ? c.slice(1).map(() => null) : null; };
    const out = cmds.map((c) => ({ result: reply(c) }));
    return new Response(JSON.stringify(Array.isArray(body[0]) ? out : out[0]), { status: 200, headers: { "content-type": "application/json" } });
  }
  throw new Error("unexpected fetch " + u);
};

const { default: handler } = await import("../api/set.js");
let status, payload;
const res = { setHeader() {}, status(c) { status = c; return this; }, json(b) { payload = b; } };
await handler({ headers: {}, query: { city: "Tokyo", country: "JP" } }, res);

const fail = (msg) => { console.error("✗ smoke:", msg, JSON.stringify(payload).slice(0, 300)); process.exit(1); };
if (status !== 200) fail(`status ${status}`);
if (payload.prints?.length !== 6) fail("expected 6 prints");
if (!payload.prints.every((p) => p.inks.every((c) => /^#[0-9A-F]{6}$/i.test(c)))) fail("inks not snapped to palette hex");
if (!claudeRequest?.output_config?.format || claudeRequest.tool_choice) fail("Claude request shape changed");
if (!claudeRequest.messages[0].content.includes("instantly recognizable")) fail("subject prompt missing");
console.log(`✓ smoke: ${payload.edition}, 6 prints, inks ${JSON.stringify(payload.prints[0].inks)}, effort ${claudeRequest.output_config.effort}`);
