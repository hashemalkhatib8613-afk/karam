# Just Us.

A private, invite-only website for two. Next.js 15 (App Router) + Supabase (Auth, Postgres with row-level security, private Storage).

Start with **SETUP.md**: it walks through free hosting on Supabase + Vercel.

## Layout

- `supabase/migrations/` — `0001_init.sql` (schema, security rules, storage, functions), `0002`/`0003` (usernames and secret-date sign-in), `0004` (active login method).
- `supabase/tests/` — a local test that checks the security rules (partner can't read drafts, locked notes, etc.).
- `src/app/(app)` — the partner site. `src/app/(intro)` — the first-visit envelope. `src/app/admin` — the admin panel.
- `src/app/actions` — server actions (every admin action re-checks the admin role).
- `src/components/ui.tsx` — the design-system components. `src/styles` — design tokens and app CSS.

## Local development

```bash
cp .env.example .env.local   # fill in your Supabase values
npm install
npm run dev
```

## Security model in one paragraph

In **Admin → Site settings → Sign-in**, choose exactly one active login method: email and password (the default), username and password, or Our date. Configure her username or enable her secret date in Accounts first. Disabled methods are rejected by the login actions, including forms opened before a setting change. Admins can always sign in with email and password at `/login/admin`; that route accepts admin accounts only.

Nobody is signed up publicly. The first user becomes admin, everyone else is invited. Row-level security decides what each person can read: the partner only sees published, due content; note bodies are never sent while a note is locked; clue answers are stored hashed and checked in the database with attempt limiting. Photos live in a private bucket and are shown through one-hour signed links. The service-role key is used only on the server to send invitations, after the caller is verified as admin.
