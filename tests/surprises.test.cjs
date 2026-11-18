const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText;
  vm.runInNewContext(code, { exports, require });
  return exports;
}

test('surprise countdown uses friendly units', () => {
  const s = load('src/lib/surprises.ts');
  const now = Date.parse('2026-12-20T12:00:00Z');
  assert.equal(s.surpriseCountdown('2026-12-20T12:30:00Z', now), '30 min');
  assert.equal(s.surpriseCountdown('2026-12-21T12:00:00Z', now), '24 hr');
  assert.equal(s.surpriseCountdown('2026-12-23T12:00:00Z', now), '3 days');
});

test('surprises are connected to admin and partner pages without exposing messages in cards', () => {
  const entities = fs.readFileSync('src/lib/entities.ts', 'utf8');
  const list = fs.readFileSync('src/app/(app)/surprises/page.tsx', 'utf8');
  const detail = fs.readFileSync('src/app/(app)/surprises/[id]/page.tsx', 'utf8');
  const adminNav = fs.readFileSync('src/components/admin/AdminNav.tsx', 'utf8');
  const more = fs.readFileSync('src/app/(app)/more/page.tsx', 'utf8');
  assert.match(entities, /table: "surprises"/);
  assert.match(adminNav, /\/admin\/surprises/);
  assert.match(more, /href: "\/surprises"/);
  assert.match(list, /from\("surprise_cards"\)/);
  assert.doesNotMatch(list, /select\([^\n]*message/);
  assert.match(detail, /from\("surprises"\)/);
});
