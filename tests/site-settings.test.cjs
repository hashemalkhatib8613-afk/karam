const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require: id => imports[id] ?? require(id), FormData });
  return exports;
}
const text = load('src/lib/text.ts');
const methods = load('src/lib/login-method.ts');
const hero = '11111111-1111-4111-8111-111111111111';
const fields = {
  shared_display_name: 'Our name', site_name: 'Our site', tagline: 'Our tagline',
  greeting: 'Hello [HER_NAME]', login_headline: 'Come in', login_subtitle: 'Welcome back',
  login_method: 'email', home_headline: 'Together', home_subtitle: 'Always',
  welcome_letter: 'First paragraph\n\nSecond paragraph', welcome_signature: 'Love',
  relationship_start_date: '2020-02-14', timezone: 'Asia/Amman', theme: 'midnight-love',
  motion: 'reduced', hero_asset_id: hero, replay_welcome: 'on',
  floating_icons_layer: 'foreground', floating_icons_quantity: 'max',
  welcome_pop_hint_enabled: 'on', welcome_pop_hint_show_on: 'letter_open',
  welcome_pop_hint_frequency: 'every_visit', welcome_pop_hint_delay_seconds: '4',
  welcome_pop_hint_prompt: 'Catch me', welcome_pop_hint_success: 'You found it',
  ff_polaroid: 'on', ff_replies: 'on', ff_bucket_list: 'on', ff_downloads: 'on',
  sec_hero: 'on', ord_hero: '6', sec_counter: 'on', ord_counter: '1',
  ord_song: '2', sec_note: 'on', ord_note: '3', ord_album: '4', ord_chapter: '5',
};
function form(overrides = {}) {
  const fd = new FormData();
  for (const [key, value] of Object.entries({ ...fields, ...overrides })) {
    if (value !== null) fd.set(key, value);
  }
  return fd;
}
function harness({ readError = false, writeError = false, missingRow = false, forbidden = false } = {}) {
  let row = { id: 1, welcome_version: 3, welcome_pop_hint_version: 2, feature_flags: { future_setting: true, downloads: true } };
  const writes = [], audits = [], refreshed = [];
  const supabase = {
    from(table) {
      assert.equal(table, 'site_settings');
      let patch;
      const query = {
        select() { return query; }, eq() { return query; },
        update(value) { patch = value; writes.push(value); return query; },
        async maybeSingle() { return { data: { timezone: 'Asia/Amman' } }; },
        async single() {
          if (!patch) return { data: readError ? null : row, error: readError ? { message: 'read failed' } : null };
          if (writeError || missingRow) return { data: null, error: { message: missingRow ? 'No settings row' : 'Missing column' } };
          row = { ...row, ...patch };
          return { data: { id: 1 }, error: null };
        },
      };
      return query;
    },
    async rpc(...args) { audits.push(args); return {}; },
  };
  const auth = { requireAdmin: async () => { if (forbidden) throw new Error('forbidden'); return { supabase }; } };
  const actions = load('src/app/actions/admin.ts', {
    '@/lib/auth': auth, '@/lib/text': text, '@/lib/login-method': methods,
    '@/lib/entities': {}, '@/lib/dates': {}, '@/lib/usage': {}, '@/lib/supabase/admin': {},
    'next/cache': { revalidatePath: (...args) => refreshed.push(args) }, 'next/navigation': {},
  });
  return { actions, supabase, auth, writes, audits, refreshed, row: () => row };
}

test('one save persists every setting, extras, section order, and welcome replay', async () => {
  const h = harness();
  assert.ok((await h.actions.saveSettings(undefined, form())).ok);
  assert.equal(h.writes.length, 1);
  const saved = h.row();
  for (const key of Object.keys(fields).filter(key => !/^(ff_|sec_|ord_|replay_|welcome_pop_hint_enabled$|welcome_pop_hint_delay_seconds$)/.test(key))) {
    assert.equal(saved[key], fields[key], key);
  }
  assert.equal(saved.welcome_pop_hint_enabled, true);
  assert.equal(saved.welcome_pop_hint_delay_seconds, 4);
  assert.deepEqual(JSON.parse(JSON.stringify(saved.feature_flags)), {
    future_setting: true, downloads: true, polaroid: true, replies: true, bucket_list: true,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(saved.home_sections)), [
    { key: 'counter', on: true }, { key: 'song', on: false }, { key: 'note', on: true },
    { key: 'album', on: false }, { key: 'chapter', on: false }, { key: 'hero', on: true },
  ]);
  assert.equal(saved.welcome_version, 4);
  assert.equal(h.audits.length, 1);
  assert.equal(h.refreshed.length, 1);
});

test('unchecked flags and cleared optional settings are persisted', async () => {
  const h = harness();
  assert.ok((await h.actions.saveSettings(undefined, form({
    ff_polaroid: null, ff_replies: null, ff_bucket_list: null, ff_downloads: null,
    relationship_start_date: '', hero_asset_id: '', replay_welcome: null,
  }))).ok);
  const saved = h.row();
  for (const flag of ['polaroid', 'replies', 'bucket_list', 'downloads']) assert.equal(saved.feature_flags[flag], false);
  assert.equal(saved.feature_flags.future_setting, true);
  assert.equal(saved.relationship_start_date, null);
  assert.equal(saved.hero_asset_id, null);
  assert.equal(saved.welcome_version, 3);
});

for (const failure of ['readError', 'writeError', 'missingRow']) {
  test(`${failure} never reports success or records a successful save`, async () => {
    const h = harness({ [failure]: true });
    const result = await h.actions.saveSettings(undefined, form());
    assert.ok(result.error);
    assert.equal(result.ok, undefined);
    assert.equal(h.audits.length, 0);
    assert.equal(h.refreshed.length, 0);
    if (failure === 'readError') assert.equal(h.writes.length, 0);
  });
}

test('settings writes still require admin access', async () => {
  const h = harness({ forbidden: true });
  await assert.rejects(() => h.actions.saveSettings(undefined, form()), /forbidden/);
  assert.equal(h.writes.length, 0);
});

test('an email address cannot be saved as the public sign-in headline', async () => {
  const h = harness();
  const result = await h.actions.saveSettings(undefined, form({ login_headline: 'admin@example.com' }));
  assert.match(result.error, /cannot contain an email address/);
  assert.equal(h.writes.length, 0);
});

test('the settings page includes extras inside the same save form', async () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const h = harness();
  const Settings = load('src/app/admin/settings/page.tsx', {
    '@/lib/auth': h.auth, '@/lib/text': text, '@/lib/login-method': methods,
    '@/lib/picker': { loadPickerAssets: async () => [] }, '@/app/actions/admin': h.actions,
    '@/components/admin/ActionForm': { default: ({ children, submitLabel }) => React.createElement('form', null, children, React.createElement('button', null, submitLabel)) },
    '@/components/admin/MediaPicker': { default: () => null },
  }).default;
  const html = renderToStaticMarkup(await Settings());
  assert.equal((html.match(/<form\b/g) ?? []).length, 1);
  for (const flag of ['polaroid', 'replies', 'bucket_list', 'downloads']) assert.ok(html.includes(`name="ff_${flag}"`));
  assert.ok(html.includes('name="pop_nicknames"'));
  assert.ok(html.includes('name="floating_icons_layer"'));
  assert.ok(html.includes('name="floating_icons_quantity"'));
  assert.ok(html.includes('name="welcome_pop_hint_enabled"'));
  assert.ok(html.includes('name="welcome_pop_hint_show_on"'));
  assert.ok(html.includes('name="welcome_pop_hint_frequency"'));
  assert.ok(html.includes('Save settings'));
  assert.ok(!html.includes('Save extras'));
});

test('pop nicknames are trimmed, deduplicated, persisted, and can be cleared', async () => {
  const h = harness();
  assert.ok((await h.actions.saveSettings(undefined, form({ pop_nicknames: '  Sunshine  \n\nSweetheart\r\nSunshine' }))).ok);
  assert.deepEqual(Array.from(h.row().pop_nicknames), ['Sunshine', 'Sweetheart']);
  assert.ok((await h.actions.saveSettings(undefined, form({ pop_nicknames: '' }))).ok);
  assert.deepEqual(Array.from(h.row().pop_nicknames), []);
});

test('oversized nickname lists are rejected without writing settings', async () => {
  for (const value of ['a'.repeat(51), Array.from({ length: 31 }, (_, i) => `Name ${i}`).join('\n')]) {
    const h = harness();
    assert.ok((await h.actions.saveSettings(undefined, form({ pop_nicknames: value }))).error);
    assert.equal(h.writes.length, 0);
  }
});

test('invalid floating icon choices fall back to safe defaults', async () => {
  const h = harness();
  assert.ok((await h.actions.saveSettings(undefined, form({
    floating_icons_layer: 'sideways', floating_icons_quantity: 'thousands',
  }))).ok);
  assert.equal(h.row().floating_icons_layer, 'background');
  assert.equal(h.row().floating_icons_quantity, 'medium');
});
