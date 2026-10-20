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
