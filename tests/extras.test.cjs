const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
  vm.runInNewContext(code, { exports, require: id => imports[id] ?? require(id), FormData, Response, Date });
  return exports;
}
const text = load('src/lib/text.ts');
const id = '11111111-1111-4111-8111-111111111111';
const form = fields => { const fd = new FormData(); for (const [k, v] of Object.entries(fields)) fd.set(k, v); return fd; };
function harness({ enabled = true, role = 'partner', visible = true, signedIn = true, writeError = false } = {}) {
  const writes = [], downloads = [], refreshed = [];
  const supabase = {
    async rpc() { return {}; },
    from(table) {
      const query = {
        select() { return query; }, eq() { return query; },
        then(resolve) { return Promise.resolve({ error: writeError ? { message: "denied" } : null }).then(resolve); },
        async single() { return { data: { feature_flags: { polaroid: true, future_extra: true } } }; },
        update(row) { writes.push([table, row]); return query; },
        async maybeSingle() { return { data: visible ? table === 'media_assets' ? { kind: 'image', title: 'Our photo', storage_path: 'uploads/photo.jpg', mime_type: 'image/jpeg' } : { id } : null }; },
        async insert(row) { writes.push([table, row]); return { error: writeError ? { message: 'denied' } : null }; },
      };
      return query;
    },
    storage: { from(bucket) { return { async download(path) { downloads.push([bucket, path]); return { data: new Blob(['image'], { type: 'image/jpeg' }) }; } }; } },
  };
  const viewer = { supabase, user: signedIn ? { id: 'partner-id' } : null, profile: { role } };
  const auth = {
    requireUser: async () => { if (!signedIn) throw new Error('unauthenticated'); return viewer; },
    requireAdmin: async () => { if (!signedIn || role !== 'admin') throw new Error('forbidden'); return viewer; },
    getViewer: async () => viewer,
    getSettings: async () => ({ feature_flags: { replies: enabled, downloads: enabled } }),
  };
  const imports = { '@/lib/auth': auth, '@/lib/text': text, 'next/cache': { revalidatePath: path => refreshed.push(path) }, 'next/navigation': { redirect: path => { throw new Error(path); } } };
  return { partner: load('src/app/actions/partner.ts', imports), bucket: load('src/app/actions/extras.ts', imports), route: load('src/app/api/photos/[id]/download/route.ts', imports), writes, downloads, refreshed };
}
test('replies reject disabled flags, non-partners, empty/long input, and locked notes without writes', async () => {
  for (const options of [{ enabled: false }, { role: 'admin' }, { visible: false }]) {
    const h = harness(options);
    assert.ok((await h.partner.replyToNote(undefined, form({ note_id: id, body: 'A reply' }))).error);
    assert.equal(h.writes.length, 0);
  }
  for (const body of ['', ' ', 'x'.repeat(4001)]) {
    const h = harness();
    assert.ok((await h.partner.replyToNote(undefined, form({ note_id: id, body }))).error);
    assert.equal(h.writes.length, 0);
  }
});
test('reply uses the signed-in author and reports persistence failures', async () => {
  const h = harness();
  assert.ok((await h.partner.replyToNote(undefined, form({ note_id: id, body: '  Love this  ', author_id: 'someone-else' }))).ok);
  assert.equal(h.writes[0][1].author_id, 'partner-id');
  assert.equal(h.writes[0][1].body, 'Love this');
  assert.ok(h.refreshed.includes(`/notes/${id}`));
  const failing = harness({ writeError: true });
  assert.ok((await failing.partner.replyToNote(undefined, form({ note_id: id, body: 'Love' }))).error);
});
test('photo downloads require authentication, enabled flag and an RLS-visible photo', async () => {
  for (const [options, status] of [[{ signedIn: false }, 401], [{ enabled: false }, 403], [{ visible: false }, 404]]) {
    const h = harness(options);
    assert.equal((await h.route.GET(null, { params: Promise.resolve({ id }) })).status, status);
    assert.equal(h.downloads.length, 0);
  }
  const h = harness();
  assert.equal((await h.route.GET(null, { params: Promise.resolve({ id: '../bad' }) })).status, 404);
  const response = await h.route.GET(null, { params: Promise.resolve({ id }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Disposition'), 'attachment; filename="our-photo.jpg"');
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(await response.text(), 'image');
});
test('bucket list writes require admin, validate titles, and publish shared items', async () => {
  const partner = harness();
  await assert.rejects(() => partner.bucket.addBucketItem(undefined, form({ title: 'Trip' })), /forbidden/);
  assert.equal(partner.writes.length, 0);
  const admin = harness({ role: 'admin' });
  assert.ok((await admin.bucket.addBucketItem(undefined, form({ title: ' ' }))).error);
  assert.ok((await admin.bucket.addBucketItem(undefined, form({ title: 'A trip', description: 'Together' }))).ok);
  assert.equal(admin.writes[0][0], 'bucket_items');
  assert.equal(admin.writes[0][1].status, 'published');
  assert.ok(admin.refreshed.includes('/bucket-list'));
});

test('bucket completion supports undo and reports missing items', async () => {
  const h = harness({ role: 'admin' });
  assert.ok((await h.bucket.setBucketItemCompleted(undefined, form({ id, completed: 'true' }))).ok);
  assert.ok(Number.isFinite(Date.parse(h.writes[0][1].completed_at)));
  assert.ok((await h.bucket.setBucketItemCompleted(undefined, form({ id, completed: 'false' }))).ok);
  assert.equal(h.writes[1][1].completed_at, null);
  const missing = harness({ role: 'admin', visible: false });
  assert.ok((await missing.bucket.setBucketItemCompleted(undefined, form({ id, completed: 'true' }))).error);
});

test('saving extras preserves unrelated flags and only updates the feature flags column', async () => {
  const h = harness({ role: 'admin' });
  assert.ok((await h.bucket.saveExtras(undefined, form({ ff_replies: 'on', ff_bucket_list: 'on', ff_downloads: 'on' }))).ok);
  assert.deepEqual(Object.keys(h.writes[0][1]), ['feature_flags']);
  for (const key of ['polaroid', 'future_extra', 'replies', 'bucket_list', 'downloads']) assert.equal(h.writes[0][1].feature_flags[key], true);
});
