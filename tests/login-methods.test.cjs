const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Run the real server actions with deterministic Supabase and Next adapters.
function load(file, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: (id) => imports[id] ?? require(id), FormData, console });
  return exports;
}
const methods = load('src/lib/login-method.ts');
function harness(active, role = 'partner', settingsError = null) {
  const calls = [];
  const client = {
    from(table) {
      const query = {
        select() { return query; }, eq() { return query; },
        async maybeSingle() {
          return table === 'profiles'
            ? { data: { role } }
            : { data: { login_method: active }, error: settingsError };
        },
      };
      return query;
    },
    auth: {
      async signInWithPassword(input) { calls.push(['password', input.email]); return {}; },
      async getUser() { return { data: { user: { id: 'user' } } }; },
      async signOut() { calls.push(['signOut']); },
      async verifyOtp() { calls.push(['otp']); return {}; },
    },
  };
  const service = {
    async rpc(name) { calls.push([name]); return { data: name === 'lookup_login_email' ? 'partner@example.com' : 'partner' }; },
    auth: { admin: {
      async getUserById() { return { data: { user: { email: 'partner@example.com' } } }; },
      async generateLink() { return { data: { properties: { hashed_token: 'token' } } }; },
    } },
  };
  const actions = load('src/app/actions/auth.ts', {
    'next/navigation': { redirect(path) { throw new Error(`redirect:${path}`); } },
    'next/headers': { headers: async () => new Headers() },
    '@/lib/login-method': methods,
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/supabase/admin': { createServiceClient: () => service },
  });
  return { ...actions, calls };
}
function form(fields) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

test('missing or invalid configuration defaults to email', () => {
  assert.equal(methods.loginMethod(undefined), 'email');
  assert.equal(methods.loginMethod('all'), 'email');
  for (const method of ['email', 'username', 'date']) assert.equal(methods.loginMethod(method), method);
});

test('public login headlines never expose an email address', () => {
  assert.equal(methods.publicLoginHeadline('Welcome back'), 'Welcome back');
  assert.equal(methods.publicLoginHeadline('admin@example.com'), methods.DEFAULT_LOGIN_HEADLINE);
  assert.equal(methods.publicLoginHeadline('Contact admin@example.com'), methods.DEFAULT_LOGIN_HEADLINE);
  assert.equal(methods.publicLoginHeadline('  '), methods.DEFAULT_LOGIN_HEADLINE);
});

for (const active of ['email', 'username', 'date']) {
  for (const submitted of ['email', 'username', 'date']) {
    test(`${active} active: ${submitted} is ${active === submitted ? 'accepted' : 'blocked'}`, async () => {
      const h = harness(active);
      const invoke = () => submitted === 'date'
        ? h.signInWithDate(undefined, form({ date: '2020-02-14' }))
        : h.signIn(undefined, form({ identifier: submitted === 'email' ? 'partner@example.com' : 'partner', password: 'password123' }));
      if (active === submitted) await assert.rejects(invoke, /redirect:\//);
      else {
        assert.match((await invoke()).error, /no longer active/);
        assert.equal(h.calls.length, 0);
      }
    });
  }
}

test('admin email access remains available when date is active', async () => {
  const h = harness('date', 'admin');
  await assert.rejects(() => h.signIn(undefined, form({ identifier: 'admin@example.com', password: 'password123', admin_only: '1' })), /redirect:\/admin/);
});

test('partner cannot bypass the active method through admin sign-in', async () => {
  const h = harness('date');
  assert.ok((await h.signIn(undefined, form({ identifier: 'partner@example.com', password: 'password123', admin_only: '1' }))).error);
  assert.ok(h.calls.some(([name]) => name === 'signOut'));
});

test('settings lookup failure blocks authentication', async () => {
  const h = harness('email', 'partner', { message: 'offline' });
  assert.match((await h.signIn(undefined, form({ identifier: 'partner@example.com', password: 'password123' }))).error, /available/);
  assert.equal(h.calls.length, 0);
});

test('each login form renders only its configured fields and no method switcher', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const Link = ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children);
  const downloads = load('src/components/PhotoDownloads.tsx');
  const ui = load('src/components/ui.tsx', { 'next/link': Link, '@/components/PhotoCarousel': load('src/components/PhotoCarousel.tsx', { '@/components/PhotoDownloads': downloads }) });
  const LoginForm = load('src/app/login/LoginForm.tsx', {
    'next/link': Link,
    '@/components/ui': ui,
    '@/app/actions/auth': { signIn() {}, signInWithDate() {} },
  }).default;
  for (const method of ['email', 'username', 'date']) {
    const html = renderToStaticMarkup(React.createElement(LoginForm, { method }));
    assert.equal((html.match(/<form\b/g) ?? []).length, 1);
    assert.ok(!html.includes('How would you like to sign in?'));
    assert.equal(html.includes('name="date"'), method === 'date');
    assert.equal(html.includes('name="password"'), method !== 'date');
    assert.equal(html.includes('type="email"'), method === 'email');
    assert.ok(!html.includes('section-admin'));
    assert.ok(!html.includes('admin@example.com'));
    if (method !== 'date') assert.ok(html.includes('autoComplete="off"'));
    assert.equal(html.includes('/forgot-password'), method !== 'date');
  }
});

test('admin credentials are autofilled only inside the dedicated admin form', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const Link = ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children);
  const downloads = load('src/components/PhotoDownloads.tsx');
  const ui = load('src/components/ui.tsx', { 'next/link': Link, '@/components/PhotoCarousel': load('src/components/PhotoCarousel.tsx', { '@/components/PhotoDownloads': downloads }) });
  const LoginForm = load('src/app/login/LoginForm.tsx', {
    'next/link': Link,
    '@/components/ui': ui,
    '@/app/actions/auth': { signIn() {}, signInWithDate() {} },
  }).default;
  const html = renderToStaticMarkup(React.createElement(LoginForm, { method: 'email', adminOnly: true }));
  assert.ok(html.includes('autoComplete="section-admin username"'));
  assert.ok(html.includes('autoComplete="section-admin current-password"'));
});
