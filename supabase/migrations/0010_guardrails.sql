-- =============================================================================
-- 0010_guardrails.sql
-- FEATURE: No new objects. This file ASSERTS the security properties the other
--          nine migrations are supposed to have, and fails loudly if any of
--          them is missing. Run it after every future schema change — it is
--          the cheapest possible regression test for "did we just open a hole".
--
-- SAFE TO RE-RUN: yes, always. It only reads catalogs and raises.
--
-- WHAT IT CHECKS
--   1. Every table in public has RLS enabled.
--   2. Every table in public either has a policy or is a deliberately locked
--      table (admin_users, checkout_throttle).
--   3. Every view in public was created WITH (security_invoker = true).
--      A plain view executes as its OWNER and bypasses RLS on everything it
--      selects from — one "create view admin_orders as select * from orders"
--      added later without this option would publish every customer's address.
--   4. Every SECURITY DEFINER function in public pins its search_path.
--   5. anon has no privileges at all on orders / order_items / order_events.
--   6. anon can execute is_admin() (without it, the whole public storefront
--      fails, but only when logged out).
--   7. No application role can execute the *_private setting readers, and no
--      row in the integrations group is marked public. Together those are the
--      only two things standing between a secret in site_settings and anon:
--      the RLS policy hides the row, and the public accessors re-apply the same
--      filter — but a SECURITY DEFINER reader granted to anon would walk past
--      both, which is exactly the hole this pair of checks exists to catch.
-- =============================================================================

do $$
declare
  r       record;
  v_bad   text := '';
  v_count int;
begin
  ----------------------------------------------------------------------------
  -- 1 + 2. RLS on every table; every table has policies or is intentionally
  --        locked (RLS on, zero policies = deny-all except the owner).
  ----------------------------------------------------------------------------
  for r in
    select c.relname,
           c.relrowsecurity,
           (select count(*) from pg_policy p where p.polrelid = c.oid) as policies
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
  loop
    if not r.relrowsecurity then
      v_bad := v_bad || format(E'\n  - table public.%I has RLS DISABLED', r.relname);
    elsif r.policies = 0 and r.relname not in ('admin_users', 'checkout_throttle') then
      v_bad := v_bad || format(
        E'\n  - table public.%I has RLS on but no policies (locked). Intentional only for admin_users and checkout_throttle.',
        r.relname);
    end if;
  end loop;

  ----------------------------------------------------------------------------
  -- 3. security_invoker on every view.
  ----------------------------------------------------------------------------
  for r in
    select c.relname, c.reloptions
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'v'
  loop
    if r.reloptions is null
       or not ('security_invoker=true' = any(r.reloptions) or 'security_invoker=on' = any(r.reloptions)) then
      v_bad := v_bad || format(
        E'\n  - view public.%I is NOT security_invoker: it runs as its owner and bypasses RLS.',
        r.relname);
    end if;
  end loop;

  ----------------------------------------------------------------------------
  -- 4. Pinned search_path on every SECURITY DEFINER function.
  ----------------------------------------------------------------------------
  for r in
    select p.proname, p.proconfig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
  loop
    if r.proconfig is null
       or not exists (select 1 from unnest(r.proconfig) cfg where cfg like 'search_path=%') then
      v_bad := v_bad || format(
        E'\n  - function public.%I() is SECURITY DEFINER with no pinned search_path.', r.proname);
    end if;
  end loop;

  ----------------------------------------------------------------------------
  -- 5. anon must hold nothing on the PII tables.
  ----------------------------------------------------------------------------
  for r in
    select unnest(array['orders','order_items','order_events','checkout_throttle','admin_users']) as t
  loop
    if has_table_privilege('anon', 'public.' || r.t, 'select')
       or has_table_privilege('anon', 'public.' || r.t, 'insert')
       or has_table_privilege('anon', 'public.' || r.t, 'update')
       or has_table_privilege('anon', 'public.' || r.t, 'delete') then
      v_bad := v_bad || format(E'\n  - role anon holds a privilege on public.%I. It must hold none.', r.t);
    end if;
  end loop;

  ----------------------------------------------------------------------------
  -- 6. anon must be able to execute is_admin(), or every public read fails.
  ----------------------------------------------------------------------------
  if not has_function_privilege('anon', 'public.is_admin()', 'execute') then
    v_bad := v_bad || E'\n  - role anon cannot execute public.is_admin(); the storefront read policies call it and will fail when logged out.';
  end if;

  ----------------------------------------------------------------------------
  -- 7a. The private setting readers ignore is_public by design, so no
  --     application role may execute them.
  ----------------------------------------------------------------------------
  for r in
    select unnest(array['public.setting_text_private(text, text)',
                        'public.setting_int_private(text, integer)',
                        'public.setting_bool_private(text, boolean)',
                        'public.request_ip_hint()',
                        'public.throttle_bucket(text)',
                        'public.hash_order_token(text)',
                        'public.new_order_token()']) as f
  loop
    if has_function_privilege('anon', r.f, 'execute')
       or has_function_privilege('authenticated', r.f, 'execute') then
      v_bad := v_bad || format(
        E'\n  - %s is executable by an application role. It bypasses is_public / hands out internals and must be owner-only.', r.f);
    end if;
  end loop;

  ----------------------------------------------------------------------------
  -- 7b. Nothing in the integrations group may be publicly readable.
  ----------------------------------------------------------------------------
  select count(*) into v_count
    from public.site_settings
   where group_key = 'integrations' and is_public;
  if v_count > 0 then
    v_bad := v_bad || format(
      E'\n  - % row(s) in site_settings.group_key = ''integrations'' are is_public = true and are being served to anon.', v_count);
  end if;

  if v_bad <> '' then
    raise exception E'Franley schema guardrails FAILED:%', v_bad;
  end if;

  raise notice 'Franley schema guardrails passed.';
end
$$;

-- ---------------------------------------------------------------------------
-- Things SQL cannot check, and that must be verified by hand before launch:
--
--   * Supabase Auth: turn OFF email signup and anonymous sign-ins
--     (Dashboard -> Authentication -> Providers / Sign In). There is no
--     customer account system here. If /auth/v1/signup is left open, anyone
--     can mint an `authenticated` session. The schema still holds — being
--     authenticated grants nothing without is_admin() — but it hands an
--     attacker a role that appears in TO clauses across the schema, plus an
--     email-enumeration and mail-bomb surface.
--   * Enable MFA on the admin user. An admin compromise is the highest-value
--     target in this design and there is no second factor in the schema.
--   * The service_role key must never appear in a Client Component, a
--     NEXT_PUBLIC_ variable, or the browser bundle. The admin panel should use
--     the admin's own session with the anon key, so RLS stays the boundary.
--     Route middleware is UX, not security.
--   * Do NOT add orders / order_items / order_events to the supabase_realtime
--     publication.
--   * Never render CMS or product copy through dangerouslySetInnerHTML.
-- ---------------------------------------------------------------------------
