const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(fetch) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('src/lib/supabase/fetch.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, fetch, Request, AbortController, setTimeout, clearTimeout });
  return exports.backendFetch;
}

test('retries a temporary read failure once', async () => {
  let calls = 0;
  const fetch = load(async () => new Response('', { status: ++calls === 1 ? 503 : 200 }));
  assert.equal((await fetch('https://example.com')).status, 200);
  assert.equal(calls, 2);
});

test('does not replay writes or authorization failures', async () => {
  for (const [method, status] of [['POST', 503], ['GET', 401]]) {
    let calls = 0;
    const fetch = load(async () => { calls++; return new Response('', { status }); });
    assert.equal((await fetch('https://example.com', { method })).status, status);
    assert.equal(calls, 1);
  }
});

test('honors caller cancellation without retrying', async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const fetch = load(async (_input, init) => { calls++; init.signal.throwIfAborted(); });
  await assert.rejects(fetch('https://example.com', { signal: controller.signal }));
  assert.equal(calls, 1);
});

test('stops after two network failures', async () => {
  let calls = 0;
  const fetch = load(async () => { calls++; throw new Error('offline'); });
  await assert.rejects(fetch('https://example.com'), /offline/);
  assert.equal(calls, 2);
});
