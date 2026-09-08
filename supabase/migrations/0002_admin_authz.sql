-- =============================================================================
-- 0002_admin_authz.sql
-- FEATURE: Admin identity and the single authorisation predicate the whole
--          schema is built on.
--
--          There is NO admin sign-up flow. The client creates the auth user by
--          hand in the Supabase dashboard (Authentication -> Users -> Add
--          user), then runs:
--              select public.grant_admin('owner@franley.lk', 'owner');
--          once, from the SQL editor. See supabase/README.md.
--
-- SAFE TO RE-RUN: yes.
--
-- WHY A TABLE AND NOT "any authenticated user" AND NOT A JWT CLAIM:
--   * "any authenticated user" is not authorisation at all — if Supabase email
--     signup is ever left on, anyone can mint an authenticated session.
--   * A profiles.role column needs a self-UPDATE policy, and the moment a user
--     can update their own row they can set role='admin'. That is the single
--     most common Supabase privilege escalation. There are no customer
--     accounts here, so such a table would exist only to hold the bug.
--   * A custom JWT claim lives in dashboard config, not in a migration the
--     client runs, and is stale until the token refreshes — revoking a
--     compromised admin should take effect on the next request, not in an
--     hour. is_admin() reads the table live, so revocation is instant.
--     (If the per-statement lookup ever matters, is_admin()'s body can be
--     rewritten to check auth.jwt() first and fall back to the table, and not
--     one policy in this schema changes.)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- admin_users
-- -----------------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  -- Denormalised for the admin list screen only; auth.users itself is never
  -- exposed to PostgREST.
  email       text not null
                check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role        public.admin_role not null default 'admin',
  is_active   boolean not null default true,
  note        text check (note is null or length(note) <= 200),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null,
  revoked_at  timestamptz
);

comment on table public.admin_users is
  'Who is an admin. Deliberately unreachable through PostgREST: RLS on, zero policies, zero grants. The only doors are the SECURITY DEFINER functions below.';

create unique index if not exists admin_users_email_key
  on public.admin_users (lower(email));
create index if not exists admin_users_active_idx
  on public.admin_users (user_id) where is_active;

drop trigger if exists trg_admin_users_updated_at on public.admin_users;
create trigger trg_admin_users_updated_at
  before update on public.admin_users
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS: enabled, with NO policies. This is INTENTIONAL.
-- -----------------------------------------------------------------------------
-- RLS on + no permissive policy = deny-all for every role except the table
-- owner, which is exactly the SECURITY DEFINER functions below. It is also
-- what makes the classic recursive-RLS trap (42P17, "infinite recursion
-- detected in policy") structurally impossible: there is no policy here for
-- is_admin() to re-enter.
--
-- FORCE ROW LEVEL SECURITY is deliberately NOT set: FORCE would re-apply RLS
-- to the owner and reintroduce the very recursion SECURITY DEFINER avoids.
alter table public.admin_users enable row level security;

-- Grants are the first gate. Even if someone later adds a careless policy,
-- PostgREST still cannot touch a relation it has no privilege on.
revoke all on public.admin_users from anon, authenticated, public;

-- -----------------------------------------------------------------------------
-- is_admin() — the one predicate every write policy in this schema calls
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
  );
$$;

comment on function public.is_admin() is
  'True when the current auth user is an active admin. STABLE so the planner hoists it to an InitPlan (once per statement, not once per row).';

create or replace function public.is_owner()
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
       and a.role = 'owner'
  );
$$;

-- Postgres grants EXECUTE on new functions to PUBLIC by default. Every
-- SECURITY DEFINER function in this schema revokes that first and then grants
-- to exactly the roles that need it.
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_owner() from public;

-- anon MUST be able to execute is_admin(). Policy expressions run with the
-- privileges of the CALLING role, and the public storefront policies read
-- "... or public.is_admin()". Without this grant every anonymous product read
-- fails with "permission denied for function is_admin" — a break that only
-- shows up when logged out, which is the path least likely to be tested.
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_owner() to authenticated;

-- -----------------------------------------------------------------------------
-- current_admin() — powers "signed in as ..." in the admin shell
-- -----------------------------------------------------------------------------
create or replace function public.current_admin()
returns table (user_id uuid, email text, role public.admin_role)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- Explicit column list, never SELECT *: adding a column to admin_users later
  -- must not start leaking it.
  select a.user_id, a.email, a.role
    from public.admin_users a
   where a.user_id = auth.uid()
     and a.is_active
     and a.revoked_at is null;
$$;

revoke execute on function public.current_admin() from public, anon;
grant execute on function public.current_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- grant_admin / revoke_admin — bootstrap and management
-- -----------------------------------------------------------------------------
create or replace function public.grant_admin(p_email text, p_role text default 'admin')
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_role    public.admin_role;
begin
  if p_role not in ('owner', 'admin') then
    raise exception 'role must be owner or admin, got %', p_role
      using errcode = '22023';
  end if;
  v_role := p_role::public.admin_role;

  select u.id into v_user_id
    from auth.users u
   where lower(u.email) = lower(btrim(p_email))
   limit 1;

  if v_user_id is null then
    raise exception
      'No auth user with email %. Create the user first in Supabase Dashboard -> Authentication -> Users -> Add user, then run this again.',
      p_email using errcode = 'P0002';
  end if;

  insert into public.admin_users (user_id, email, role, is_active, revoked_at, created_by)
  values (v_user_id, lower(btrim(p_email)), v_role, true, null, auth.uid())
  on conflict (user_id) do update
    set role       = excluded.role,
        email      = excluded.email,
        is_active  = true,
        revoked_at = null;

  return v_user_id;
end;
$$;

comment on function public.grant_admin(text, text) is
  'Promotes an existing auth user to admin. Run from the SQL editor. EXECUTE is held only by postgres/service_role.';

create or replace function public.revoke_admin(p_email text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner_count int;
  v_row public.admin_users%rowtype;
begin
  select * into v_row
    from public.admin_users
   where lower(email) = lower(btrim(p_email));

  if not found then
    return false;
  end if;

  if v_row.role = 'owner' then
    select count(*) into v_owner_count
      from public.admin_users
     where role = 'owner' and is_active and revoked_at is null;
    if v_owner_count <= 1 then
      raise exception 'Refusing to revoke the last active owner — the store would be locked out of its own admin panel.'
        using errcode = '23514';
    end if;
  end if;

  -- Deactivate rather than delete, so order_events.actor_user_id keeps
  -- pointing at a resolvable person.
  update public.admin_users
     set is_active = false, revoked_at = now()
   where user_id = v_row.user_id;

  return true;
end;
$$;

-- These two are privilege-escalation primitives. Their grants matter more than
-- their bodies: leaving the default EXECUTE TO PUBLIC in place would let any
-- authenticated user promote themselves to admin.
revoke execute on function public.grant_admin(text, text) from public, anon, authenticated;
revoke execute on function public.revoke_admin(text)      from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- BOOTSTRAP — do this once, by hand.
--   1. Supabase Dashboard -> Authentication -> Users -> Add user
--      (email + password, "Auto Confirm User" ticked).
--   2. Uncomment the line below with that email and run it in the SQL editor.
--
-- select public.grant_admin('owner@franley.lk', 'owner');
-- ---------------------------------------------------------------------------
