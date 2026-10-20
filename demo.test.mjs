import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAmount, brl, simulate, UNAVAILABLE } from "./demo.js";

test("parseAmount", () => {
  assert.equal(parseAmount("1.000,50"), 1000.5);
  assert.equal(parseAmount("R$ 1.000,50"), 1000.5);
  assert.equal(parseAmount("1000"), 1000);
  assert.equal(parseAmount("10.000"), 10000);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("-5"), null);
  assert.equal(parseAmount("abc"), null);
  assert.equal(parseAmount("10000001"), null);
  // Ponto como separador decimal (teclado de celular) não pode virar milhar.
  assert.equal(parseAmount("1000.50"), 1000.5);
  assert.equal(parseAmount("10.5"), 10.5);
  assert.equal(parseAmount("1.000.000"), 1000000);
  assert.equal(parseAmount("0,50"), null); // a API exige no mínimo R$ 1
});

test("input underline has 3:1 contrast in light theme", async () => {
  const css = (await import("node:fs")).readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  const root = css.slice(css.indexOf(":root {"), css.indexOf("}"));
  const token = (name) => root.match(new RegExp("--" + name + ":\\s*(#[0-9a-f]{6})", "i"))[1];
  const lum = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [a, b] = [lum(token("ochre-bright")), lum(token("paper-deep"))].sort((x, y) => y - x);
  assert.ok((a + 0.05) / (b + 0.05) >= 3, `contraste ${((a + 0.05) / (b + 0.05)).toFixed(2)}`);
});

test("brl", () => assert.equal(brl(1234.5).replace(/\s/g, " "), "R$ 1.234,50"));

test("simulate timeout", async () => {
  const r = await simulate({}, () => new Promise(() => {}), 10, "https://api.test");
  assert.deepEqual(r, { ok: false, message: UNAVAILABLE });
});

test("simulate network error", async () => {
  const r = await simulate({}, async () => { throw new TypeError("Failed to fetch"); }, 100, "https://api.test");
  assert.deepEqual(r, { ok: false, message: UNAVAILABLE });
});

test("simulate without API_URL is unavailable", async () => {
  const r = await simulate({}, async () => assert.fail("não deve chamar"), 100, "");
  assert.deepEqual(r, { ok: false, message: UNAVAILABLE });
});

test("simulate 400 shows api error", async () => {
  const r = await simulate({}, async () => new Response(JSON.stringify({ error: "days inválido" }), { status: 400 }), 100, "https://api.test");
  assert.deepEqual(r, { ok: false, message: "days inválido" });
});

test("simulate ok returns data", async () => {
  let called;
  const r = await simulate({ a: 1 }, async (url, init) => { called = [url, init.method, init.body]; return new Response('{"results":[]}', { status: 200 }); }, 100, "https://api.test");
  assert.deepEqual(r, { ok: true, data: { results: [] } });
  assert.deepEqual(called, ["https://api.test/simulate", "POST", '{"a":1}']);
});
