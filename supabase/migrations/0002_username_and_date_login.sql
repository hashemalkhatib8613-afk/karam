-- Just Us. — extra sign-in methods: username + a secret date.
-- Run after 0001_init.sql.

-- ---------------------------------------------------------------- usernames
alter table public.profiles add column username text;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9._-]{3,30}$');
create unique index profiles_username_key on public.profiles (username) where username is not null;

-- ---------------------------------------------------------------- date sign-in (single row) + attempt log
-- Both tables are reachable only through the functions below (no policies, no grants).
create table public.date_login (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  user_id uuid references auth.users(id) on delete set null,
  date_hash text,
  updated_at timestamptz not null default now()
);
insert into public.date_login (id) values (1);
alter table public.date_login enable row level security;
revoke all on public.date_login from public, anon, authenticated;

create table public.login_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  ok boolean not null default false,
  at timestamptz not null default now()
);
create index on public.login_attempts (ip_hash, at desc);
create index on public.login_attempts (at desc) where not ok;
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from public, anon, authenticated;
