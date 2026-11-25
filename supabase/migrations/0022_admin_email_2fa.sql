-- =============================================================================
-- 0022_admin_email_2fa.sql
-- FEATURE: Two-step sign-in for the admin panel — a 6-digit code sent by email
--          at every sign-in — ENFORCED IN THE DATABASE.
--
--   Supabase's built-in MFA has no email factor, so this builds one. The
--   password alone no longer makes anyone an admin: public.is_admin() — the
--   predicate every admin policy, RPC and storage rule in this schema calls —
--   now ALSO requires that the caller's Supabase session (the `session_id`
--   claim in their access token) has been verified with an emailed code in the
--   last 12 hours. Someone who has only the password, and who calls the
--   Supabase API directly with the public anon key, gets exactly what a
--   logged-out shopper gets.
--
--   How a sign-in goes:
--     1. Email + password, as before -> a Supabase session (session_id S).
--     2. /admin/verify: the server (service_role) calls admin_mfa_issue_code(S,
--        user, code). Only a salted SHA-256 of the code is stored. 10-minute
--        expiry, 5 wrong tries, one resend per 60 s, 10 emails per hour.
--     3. The right code -> admin_mfa_verify_code() writes admin_mfa_sessions(S),
--        valid until the Supabase session ends (sign-out deletes the row; the
--        row also cascades away with auth.sessions) or 12 hours, whichever is
--        first. Then is_admin() is true for that session — and only that one.
--
-- TABLES (all: RLS on, every grant revoked from anon/authenticated/public, a
--         restrictive deny-all policy; only the server, with the service-role
--         key, and the SECURITY DEFINER functions below touch them):
--   admin_mfa_settings  one row: the emergency switch.
--   admin_mfa_codes     the pending code per session (hash + salt, attempts).
--   admin_mfa_sessions  sessions that passed the code check.
--   admin_mfa_sends     one row per code emailed, for the hourly cap.
--
-- -----------------------------------------------------------------------------
-- EMERGENCY SWITCH — if code emails stop arriving (Resend down, domain
-- unverified, key revoked) and nobody can get into the admin panel:
--
--   Supabase Dashboard -> SQL Editor, run:
--
--     update public.admin_mfa_settings set email_2fa_enabled = false;
--
--   Admins then get in with the password alone (is_admin() ignores the code
--   requirement; the app skips /admin/verify). Fix email, then TURN IT BACK ON:
--
--     update public.admin_mfa_settings set email_2fa_enabled = true;
--
--   If the row was ever deleted, two-step sign-in stays ON (fails closed);
--   re-create it with:
--     insert into public.admin_mfa_settings (id, email_2fa_enabled) values (true, false)
--       on conflict (id) do update set email_2fa_enabled = excluded.email_2fa_enabled;
--
--   To sign every admin device out of the panel at once (e.g. after a lost
--   laptop):   delete from public.admin_mfa_sessions;
-- -----------------------------------------------------------------------------
--
-- SAFE TO RE-RUN: yes. Tables are IF NOT EXISTS, policies are dropped before
--          being created, functions are CREATE OR REPLACE, grants idempotent.
--
-- RUN AFTER 0017 (or the latest migration), then re-run 0010 (guardrails) last.
-- RE-RUN THIS FILE AFTER ANY RE-RUN OF 0002 — 0002 would put back the
--          password-only bodies of is_admin(), is_owner() and current_admin().
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The emergency switch. One row, id = true.
-- -----------------------------------------------------------------------------
create table if not exists public.admin_mfa_settings (
  id                 boolean primary key default true check (id),
  email_2fa_enabled  boolean not null default true,
  updated_at         timestamptz not null default now()
);

comment on table public.admin_mfa_settings is
  'Emergency switch for admin email two-step sign-in. email_2fa_enabled = false lets admins in with the password alone. Change it from the SQL editor only.';

insert into public.admin_mfa_settings (id, email_2fa_enabled)
values (true, true)
on conflict (id) do nothing;

drop trigger if exists trg_admin_mfa_settings_updated_at on public.admin_mfa_settings;
create trigger trg_admin_mfa_settings_updated_at
  before update on public.admin_mfa_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Pending codes — one per Supabase session.
-- -----------------------------------------------------------------------------
create table if not exists public.admin_mfa_codes (
  session_id  uuid primary key,
  user_id     uuid not null references public.admin_users(user_id) on delete cascade,
  -- hex SHA-256 of salt:session_id:code. The code itself is never stored.
  salt        text not null check (length(salt) between 32 and 128),
  code_hash   text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  attempts    integer not null default 0 check (attempts between 0 and 100),
  sent_at     timestamptz not null default now(),
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists admin_mfa_codes_user_idx on public.admin_mfa_codes (user_id);

comment on table public.admin_mfa_codes is
  'Pending admin sign-in codes, hashed. Server-only (service_role); no client role has any grant.';

-- -----------------------------------------------------------------------------
-- 3. Verified sessions — what is_admin() checks.
-- -----------------------------------------------------------------------------
create table if not exists public.admin_mfa_sessions (
  session_id   uuid primary key,
  user_id      uuid not null references public.admin_users(user_id) on delete cascade,
  verified_at  timestamptz not null default now(),
  expires_at   timestamptz not null,
  constraint admin_mfa_sessions_cap check (expires_at <= verified_at + interval '12 hours')
);

create index if not exists admin_mfa_sessions_user_idx on public.admin_mfa_sessions (user_id);

comment on table public.admin_mfa_sessions is
  'Supabase sessions (auth.jwt() ->> session_id) that passed the emailed code check. is_admin() requires a live row. Server-only.';

-- -----------------------------------------------------------------------------
-- 4. Send log — the hourly cap, so a stolen password cannot mail-bomb the owner.
-- -----------------------------------------------------------------------------
create table if not exists public.admin_mfa_sends (
  id       bigint generated always as identity primary key,
  user_id  uuid not null references public.admin_users(user_id) on delete cascade,
  sent_at  timestamptz not null default now()
);

create index if not exists admin_mfa_sends_user_time_idx on public.admin_mfa_sends (user_id, sent_at);

-- -----------------------------------------------------------------------------
-- 5. Tie codes and verified sessions to the live Supabase session: when Auth
--    deletes the session (sign-out, "sign out everywhere", session timebox),
--    the rows go with it. Best effort — the app also deletes the row on
--    sign-out and the 12-hour cap applies regardless.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'admin_mfa_sessions_session_fkey') then
    execute 'alter table public.admin_mfa_sessions
               add constraint admin_mfa_sessions_session_fkey
               foreign key (session_id) references auth.sessions(id) on delete cascade';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'admin_mfa_codes_session_fkey') then
    execute 'alter table public.admin_mfa_codes
               add constraint admin_mfa_codes_session_fkey
               foreign key (session_id) references auth.sessions(id) on delete cascade';
  end if;
exception
  when insufficient_privilege or undefined_table or undefined_column then
    raise warning 'Could not link admin_mfa_* to auth.sessions (%). Not required: sign-out deletes the row and verified sessions expire after 12 hours anyway.', sqlerrm;
end
$$;

-- -----------------------------------------------------------------------------
-- 6. Lock all four tables. Grants are the first gate; the restrictive deny-all
--    policy is the second (and satisfies 0010's "every table has a policy").
--    The service_role key bypasses RLS; SECURITY DEFINER functions run as the
--    table owner, which RLS does not apply to (FORCE is deliberately not set).
-- -----------------------------------------------------------------------------
alter table public.admin_mfa_settings enable row level security;
alter table public.admin_mfa_codes    enable row level security;
alter table public.admin_mfa_sessions enable row level security;
alter table public.admin_mfa_sends    enable row level security;

revoke all on public.admin_mfa_settings from anon, authenticated, public;
revoke all on public.admin_mfa_codes    from anon, authenticated, public;
revoke all on public.admin_mfa_sessions from anon, authenticated, public;
revoke all on public.admin_mfa_sends    from anon, authenticated, public;

grant select, insert, update, delete on public.admin_mfa_codes    to service_role;
grant select, insert, update, delete on public.admin_mfa_sessions to service_role;
grant select on public.admin_mfa_settings to service_role;

drop policy if exists admin_mfa_settings_no_client on public.admin_mfa_settings;
create policy admin_mfa_settings_no_client on public.admin_mfa_settings
  as restrictive for all to anon, authenticated using (false) with check (false);

drop policy if exists admin_mfa_codes_no_client on public.admin_mfa_codes;
create policy admin_mfa_codes_no_client on public.admin_mfa_codes
  as restrictive for all to anon, authenticated using (false) with check (false);

drop policy if exists admin_mfa_sessions_no_client on public.admin_mfa_sessions;
create policy admin_mfa_sessions_no_client on public.admin_mfa_sessions
  as restrictive for all to anon, authenticated using (false) with check (false);

drop policy if exists admin_mfa_sends_no_client on public.admin_mfa_sends;
create policy admin_mfa_sends_no_client on public.admin_mfa_sends
  as restrictive for all to anon, authenticated using (false) with check (false);

-- -----------------------------------------------------------------------------
-- 7. Helpers.
-- -----------------------------------------------------------------------------
-- The caller's session id from the verified JWT, or null. A malformed claim
-- yields null rather than a cast error that would break every public read.
create or replace function public.admin_mfa_jwt_session_id()
returns uuid
language sql
stable
set search_path = public, pg_temp
as $$
  select case
           when (auth.jwt() ->> 'session_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           then (auth.jwt() ->> 'session_id')::uuid
         end;
$$;

-- Salted hash of a code, bound to its session so a hash cannot be replayed
-- against another session's row.
create or replace function public.admin_mfa_hash(p_salt text, p_session_id uuid, p_code text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select encode(sha256(convert_to(p_salt || ':' || p_session_id::text || ':' || p_code, 'UTF8')), 'hex');
$$;

revoke execute on function public.admin_mfa_hash(text, uuid, text) from public, anon, authenticated;
-- Harmless (it only reads the caller's own token) but nothing outside the
-- functions below needs it.
revoke execute on function public.admin_mfa_jwt_session_id() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 8. is_admin() — 0002's predicate plus the verified-session requirement.
--    Same signature, language, STABLE, SECURITY DEFINER and pinned search_path,
--    so not one policy changes. anon keeps EXECUTE (storefront policies call it
--    while logged out; for anon auth.uid() is null and it is simply false).
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.admin_users a
     where a.user_id = auth.uid()
       and a.is_active
       and a.revoked_at is null
       and (
         -- Emergency switch. No row -> enforced.
         exists (select 1 from public.admin_mfa_settings s
                  where s.id and not s.email_2fa_enabled)
         or exists (
           select 1
             from public.admin_mfa_sessions m
            where m.session_id = public.admin_mfa_jwt_session_id()
              and m.user_id = a.user_id
              and m.expires_at > now()
         )
       )
  );
$$;

comment on function public.is_admin() is
  'True when the current auth user is an active admin AND this Supabase session passed the emailed code check (0022), unless admin_mfa_settings.email_2fa_enabled is false. STABLE so the planner hoists it to an InitPlan.';

-- is_owner(): nothing calls it today, but it must not become a side door.
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_admin()
     and exists (
       select 1
         from public.admin_users a
        where a.user_id = auth.uid()
          and a.is_active
          and a.revoked_at is null
          and a.role = 'owner'
     );
$$;

-- current_admin(): identity of a fully signed-in admin only. The app uses
-- admin_mfa_status() to tell "admin, code pending" apart from "not an admin".
create or replace function public.current_admin()
returns table (user_id uuid, email text, role public.admin_role)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.user_id, a.email, a.role
    from public.admin_users a
   where a.user_id = auth.uid()
     and a.is_active
     and a.revoked_at is null
     and public.is_admin();
$$;

revoke execute on function public.is_admin() from public;
grant  execute on function public.is_admin() to anon, authenticated;
revoke execute on function public.is_owner() from public, anon;
grant  execute on function public.is_owner() to authenticated;
revoke execute on function public.current_admin() from public, anon;
grant  execute on function public.current_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- 9. admin_mfa_status() — for requireAdmin() and /admin/verify.
--    Zero rows: not an active admin. One row: mfa_required says whether the
--    switch is on; session_verified says whether THIS session may act as admin
--    (true when the switch is off). Reveals nothing about codes.
-- -----------------------------------------------------------------------------
create or replace function public.admin_mfa_status()
returns table (user_id uuid, email text, role public.admin_role, mfa_required boolean, session_verified boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.user_id,
         a.email,
         a.role,
         not exists (select 1 from public.admin_mfa_settings s where s.id and not s.email_2fa_enabled),
         public.is_admin()
    from public.admin_users a
   where a.user_id = auth.uid()
     and a.is_active
     and a.revoked_at is null;
$$;

revoke execute on function public.admin_mfa_status() from public, anon;
grant  execute on function public.admin_mfa_status() to authenticated;

-- -----------------------------------------------------------------------------
-- 10. admin_mfa_issue_code — SERVER ONLY. The app generates the code, passes
--     the session id and user id taken from the caller's verified JWT, and
--     emails the code only when this returns 'ok'.
--     Returns: ok | too_soon | rate_limited | not_admin
-- -----------------------------------------------------------------------------
create or replace function public.admin_mfa_issue_code(p_session_id uuid, p_user_id uuid, p_code text)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row    public.admin_mfa_codes%rowtype;
  v_recent integer;
  v_salt   text;
begin
  if p_session_id is null or p_user_id is null or p_code is null or p_code !~ '^[0-9]{6}$' then
    raise exception 'Invalid arguments' using errcode = '22023';
  end if;

  if not exists (select 1 from public.admin_users a
                  where a.user_id = p_user_id and a.is_active and a.revoked_at is null) then
    return 'not_admin';
  end if;

  -- One issuer at a time per admin, so the 60 s and hourly limits hold under
  -- concurrent requests.
  perform pg_advisory_xact_lock(hashtextextended('franley_admin_mfa:' || p_user_id::text, 0));

  -- Housekeeping.
  delete from public.admin_mfa_codes    where expires_at < now() - interval '1 day';
  delete from public.admin_mfa_sessions where expires_at < now();
  delete from public.admin_mfa_sends    where sent_at < now() - interval '1 day';

  select * into v_row from public.admin_mfa_codes where session_id = p_session_id;
  if found and v_row.user_id <> p_user_id then
    return 'not_admin';
  end if;
  if found and v_row.sent_at > now() - interval '60 seconds' then
    return 'too_soon';
  end if;

  select count(*) into v_recent
    from public.admin_mfa_sends
   where user_id = p_user_id and sent_at > now() - interval '1 hour';
  if v_recent >= 10 then
    return 'rate_limited';
  end if;

  v_salt := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  insert into public.admin_mfa_codes (session_id, user_id, salt, code_hash, attempts, sent_at, expires_at)
  values (p_session_id, p_user_id, v_salt, public.admin_mfa_hash(v_salt, p_session_id, p_code),
          0, now(), now() + interval '10 minutes')
  on conflict (session_id) do update
    set salt       = excluded.salt,
        code_hash  = excluded.code_hash,
        attempts   = 0,
        sent_at    = excluded.sent_at,
        expires_at = excluded.expires_at;

  insert into public.admin_mfa_sends (user_id) values (p_user_id);

  return 'ok';
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. admin_mfa_verify_code — SERVER ONLY. Atomic: the row is locked, so five
--     wrong tries means five, even under parallel requests.
--     Returns: ok | invalid | expired | locked
-- -----------------------------------------------------------------------------
create or replace function public.admin_mfa_verify_code(
  p_session_id uuid,
  p_user_id uuid,
  p_code text,
  p_session_hours integer default 12)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_row   public.admin_mfa_codes%rowtype;
  v_hours integer := least(greatest(coalesce(p_session_hours, 12), 1), 12);
begin
  if p_session_id is null or p_user_id is null then
    raise exception 'Invalid arguments' using errcode = '22023';
  end if;

  if not exists (select 1 from public.admin_users a
                  where a.user_id = p_user_id and a.is_active and a.revoked_at is null) then
    return 'invalid';
  end if;

  select * into v_row from public.admin_mfa_codes
   where session_id = p_session_id
   for update;

  if not found or v_row.user_id <> p_user_id then
    return 'expired';
  end if;

  if v_row.expires_at <= now() then
    delete from public.admin_mfa_codes where session_id = p_session_id;
    return 'expired';
  end if;

  if v_row.attempts >= 5 then
    return 'locked';
  end if;

  if p_code is null
     or p_code !~ '^[0-9]{6}$'
     or public.admin_mfa_hash(v_row.salt, p_session_id, p_code) <> v_row.code_hash then
    update public.admin_mfa_codes set attempts = attempts + 1 where session_id = p_session_id;
    return case when v_row.attempts + 1 >= 5 then 'locked' else 'invalid' end;
  end if;

  delete from public.admin_mfa_codes where session_id = p_session_id;

  insert into public.admin_mfa_sessions (session_id, user_id, verified_at, expires_at)
  values (p_session_id, p_user_id, now(), now() + make_interval(hours => v_hours))
  on conflict (session_id) do update
    set verified_at = excluded.verified_at,
        expires_at  = excluded.expires_at
    where public.admin_mfa_sessions.user_id = excluded.user_id;

  return 'ok';
end;
$$;

-- Both are privilege-granting primitives: anyone able to call issue_code could
-- pick their own code. service_role only.
revoke execute on function public.admin_mfa_issue_code(uuid, uuid, text) from public, anon, authenticated;
grant  execute on function public.admin_mfa_issue_code(uuid, uuid, text) to service_role;
revoke execute on function public.admin_mfa_verify_code(uuid, uuid, text, integer) from public, anon, authenticated;
grant  execute on function public.admin_mfa_verify_code(uuid, uuid, text, integer) to service_role;

-- -----------------------------------------------------------------------------
-- 12. Self-check.
-- -----------------------------------------------------------------------------
do $$
begin
  if not has_function_privilege('anon', 'public.is_admin()', 'execute') then
    raise exception '0022: anon lost EXECUTE on is_admin(); the storefront would break.';
  end if;
  if has_function_privilege('authenticated', 'public.admin_mfa_issue_code(uuid, uuid, text)', 'execute')
     or has_function_privilege('anon', 'public.admin_mfa_issue_code(uuid, uuid, text)', 'execute')
     or has_function_privilege('authenticated', 'public.admin_mfa_verify_code(uuid, uuid, text, integer)', 'execute')
     or has_function_privilege('anon', 'public.admin_mfa_verify_code(uuid, uuid, text, integer)', 'execute') then
    raise exception '0022: the admin code functions must be service_role only.';
  end if;
  if has_table_privilege('authenticated', 'public.admin_mfa_sessions', 'insert')
     or has_table_privilege('authenticated', 'public.admin_mfa_codes', 'select')
     or has_table_privilege('authenticated', 'public.admin_mfa_settings', 'update') then
    raise exception '0022: a client role holds a privilege on the admin_mfa tables.';
  end if;
  raise notice '0022 applied: admin email two-step sign-in is %.',
    case when exists (select 1 from public.admin_mfa_settings where id and email_2fa_enabled)
         then 'ON' else 'OFF (emergency switch)' end;
end
$$;
