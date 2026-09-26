-- =============================================================================
-- 0004_media_and_cms.sql
-- FEATURE: The CMS the client asked for — change storefront images, banners and
--          copy from the admin without a deploy — plus the media library that
--          backs it and the labelled site settings that replace the constants
--          currently hardcoded in src/lib/constants.ts.
--
--          Three tables, three jobs:
--            media_assets   uploaded images with alt text and dimensions
--            content_blocks per-page, per-key JSON content blocks
--            site_settings  scalar globals (WhatsApp number, shipping rule)
--
-- SAFE TO RE-RUN: yes.
--
-- WHY THIS SHAPE: content_blocks matches what the app already reads
--          (src/lib/cms/supabase-source.ts selects key, payload where
--          page = ... and published = true, then deep-merges onto the typed
--          defaults in src/lib/cms/defaults.ts). That merge is the reason a
--          half-filled block can never blank the homepage.
--          The usability problem with a bare jsonb blob — a wall of unlabelled
--          text boxes — is solved by making the FORM SCHEMA DATA: each row's
--          `fields` column holds an ordered array of
--          {name,label,help,type,...} specs, and the admin renders one generic
--          form-from-schema driver against it. A new band on the homepage is
--          then one INSERT plus one React component, with no migration.
--          A per-section table-per-type design was rejected for the opposite
--          reason: every new band would be a migration, a new admin page and a
--          new component, which is exactly the corner not to paint the client
--          into for a 49-SKU store.
--
-- NO RICH TEXT / NO HTML COLUMN, ON PURPOSE. If any CMS field were ever
--          rendered through dangerouslySetInnerHTML, an admin compromise would
--          become persistent XSS on the storefront's own origin, where the
--          Supabase session cookie lives. Text fields only, plus URL columns
--          constrained by public.is_safe_asset_url / is_safe_link_href.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- media_assets — one row per uploaded image
-- -----------------------------------------------------------------------------
create table if not exists public.media_assets (
  id             uuid primary key default gen_random_uuid(),
  -- Exactly one source: an object inside a Supabase Storage bucket, or an
  -- external/site-relative URL (this is how the 49 seeded /products/*.webp
  -- files are represented without re-uploading them).
  bucket         text check (bucket is null or bucket in ('product-images', 'cms-media')),
  storage_path   text check (storage_path is null or length(storage_path) between 1 and 1024),
  external_url   text check (public.is_safe_asset_url(external_url)),
  constraint media_assets_one_source
    check (num_nonnulls(storage_path, external_url) = 1),
  constraint media_assets_bucket_pairing
    check ((storage_path is null) = (bucket is null)),
  mime_type      text check (mime_type is null or
                   mime_type in ('image/webp','image/jpeg','image/png','image/avif')),
  width          integer check (width is null or width > 0),
  height         integer check (height is null or height > 0),
  byte_size      bigint check (byte_size is null or byte_size > 0),
  -- Alt text is a hard requirement unless the image is explicitly decorative;
  -- enforced here rather than in a form validator so it cannot be skipped.
  alt            text not null default '',
  is_decorative  boolean not null default false,
  constraint media_assets_alt_required
    check (is_decorative or length(btrim(alt)) > 0),
  title          text check (title is null or length(title) <= 200),
  folder         text not null default 'general'
                   check (folder in ('general','banners','editorial','products','logos','og')),
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

comment on table public.media_assets is
  'Upload registry / media picker. The public URL is composed in the app from bucket+storage_path, or taken from external_url — never baked into a generated column, which would hardcode the project ref into a migration.';

create unique index if not exists media_assets_object_key
  on public.media_assets (bucket, storage_path) where storage_path is not null;
create index if not exists media_assets_folder_idx
  on public.media_assets (folder, created_at desc) where deleted_at is null;

drop trigger if exists trg_media_assets_updated_at on public.media_assets;
create trigger trg_media_assets_updated_at
  before update on public.media_assets
  for each row execute function public.set_updated_at();

alter table public.media_assets enable row level security;

drop policy if exists media_public_read  on public.media_assets;
drop policy if exists media_admin_insert on public.media_assets;
drop policy if exists media_admin_update on public.media_assets;
drop policy if exists media_admin_delete on public.media_assets;

-- Media is inherently public (it is served from a public bucket), so hiding
-- rows buys nothing; soft-deleted rows are hidden so a retired banner stops
-- appearing anywhere.
create policy media_public_read on public.media_assets
  for select to anon, authenticated
  using (deleted_at is null or (select public.is_admin()));

create policy media_admin_insert on public.media_assets
  for insert to authenticated with check ((select public.is_admin()));
create policy media_admin_update on public.media_assets
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy media_admin_delete on public.media_assets
  for delete to authenticated using ((select public.is_admin()));

grant select on public.media_assets to anon;
grant select, insert, update, delete on public.media_assets to authenticated;

-- Now that media_assets exists, wire up the provenance FK left dangling in
-- 0003. ON DELETE SET NULL: losing the library row must never delete the image
-- off a product page.
do $$
begin
  alter table public.product_images
    add constraint product_images_media_id_fkey
    foreign key (media_id) references public.media_assets(id) on delete set null;
exception
  when duplicate_object then null;
  when duplicate_table  then null;
end
$$;

create index if not exists product_images_media_idx
  on public.product_images (media_id) where media_id is not null;

-- -----------------------------------------------------------------------------
-- content_blocks — the CMS proper
-- -----------------------------------------------------------------------------
create table if not exists public.content_blocks (
  id           uuid primary key default gen_random_uuid(),
  page         text not null
                 check (page ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(page) <= 60),
  key          text not null
                 check (key ~ '^[a-z][a-z0-9_]*$' and length(key) <= 60),
  -- Plain English for the admin screen, so the client never sees a raw key.
  label        text not null default '' check (length(label) <= 120),
  help         text check (help is null or length(help) <= 400),
  -- The content itself. Shape is per-key and is described by `fields`.
  -- Object OR array: most blocks are objects, but a list block such as the
  -- homepage marquee is a plain array of strings, and the storefront's
  -- deep-merge (src/lib/cms/index.ts) requires the override to keep the same
  -- JSON shape as the default it merges onto.
  payload      jsonb not null default '{}'::jsonb
                 check (jsonb_typeof(payload) in ('object','array')
                        and pg_column_size(payload) <= 32768),
  -- The FORM SCHEMA AS DATA: ordered array of
  -- {name,label,help,type,required,max_length,rows,options}. type is one of
  -- text | textarea | url | link | image | media | boolean | number | select |
  -- string_list (a plain array of strings, used with the "$root" name).
  -- The admin renders labelled inputs from this; adding a field costs an
  -- UPDATE, not a migration.
  fields       jsonb not null default '[]'::jsonb
                 check (jsonb_typeof(fields) = 'array'
                        and pg_column_size(fields) <= 16384),
  -- Structural rows shipped by 0009 are locked: the client may edit the
  -- content but not the schema, which would desynchronise stored payloads
  -- from the component that renders them.
  is_locked    boolean not null default false,
  published    boolean not null default true,
  position     integer not null default 0,
  publish_at   timestamptz,
  unpublish_at timestamptz,
  constraint content_blocks_window
    check (unpublish_at is null or publish_at is null or unpublish_at > publish_at),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id) on delete set null,
  constraint content_blocks_page_key_unique unique (page, key)
);

comment on table public.content_blocks is
  'Per-page CMS blocks. The storefront reads: select key, payload from content_blocks where page = $1 and published — and deep-merges onto the typed defaults in src/lib/cms/defaults.ts.';

create index if not exists content_blocks_live_idx
  on public.content_blocks (page, position) where published;
create index if not exists content_blocks_admin_idx
  on public.content_blocks (page, position);

drop trigger if exists trg_content_blocks_updated_at on public.content_blocks;
create trigger trg_content_blocks_updated_at
  before update on public.content_blocks
  for each row execute function public.set_updated_at();

alter table public.content_blocks enable row level security;

drop policy if exists content_blocks_public_read  on public.content_blocks;
drop policy if exists content_blocks_admin_insert on public.content_blocks;
drop policy if exists content_blocks_admin_update on public.content_blocks;
drop policy if exists content_blocks_admin_delete on public.content_blocks;

-- The publish window lives in the POLICY, not only in the app query, so a
-- scheduled sale banner is genuinely unreadable before its time — through the
-- REST endpoint, through a hand-written query, and through a storefront bug.
create policy content_blocks_public_read on public.content_blocks
  for select to anon, authenticated
  using (
    (select public.is_admin())
    or (
      published
      and (publish_at   is null or publish_at   <= now())
      and (unpublish_at is null or unpublish_at >  now())
    )
  );

create policy content_blocks_admin_insert on public.content_blocks
  for insert to authenticated with check ((select public.is_admin()));
create policy content_blocks_admin_update on public.content_blocks
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy content_blocks_admin_delete on public.content_blocks
  for delete to authenticated using ((select public.is_admin()));

grant select on public.content_blocks to anon;
grant select, insert, update, delete on public.content_blocks to authenticated;

-- The client IS the admin, so 'the UI just won't show it' is not protection.
-- A locked block's SCHEMA is frozen: editing `fields`, `key` or `page` from
-- the app would desynchronise the stored payload from the React component that
-- renders it. Content stays freely editable. Unlocking is a developer act in
-- the SQL editor.
create or replace function public.tg_content_blocks_lock_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.is_locked then
    if new.key <> old.key
       or new.page <> old.page
       or new.fields is distinct from old.fields then
      raise exception 'Content block %/% is locked: its key, page and field schema cannot be changed from the app.', old.page, old.key
        using errcode = '23514';
    end if;
  end if;
  new.updated_by := coalesce(auth.uid(), old.updated_by);
  return new;
end;
$$;

drop trigger if exists trg_content_blocks_lock_guard on public.content_blocks;
create trigger trg_content_blocks_lock_guard
  before update on public.content_blocks
  for each row execute function public.tg_content_blocks_lock_guard();

-- -----------------------------------------------------------------------------
-- site_settings — labelled scalar globals
-- -----------------------------------------------------------------------------
create table if not exists public.site_settings (
  key           text primary key
                  check (key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$' and length(key) <= 80),
  group_key     text not null
                  check (group_key in ('store','contact','shipping','checkout','social','seo','payment','integrations')),
  label         text not null check (length(label) between 1 and 120),
  help          text check (help is null or length(help) <= 400),
  value_type    text not null
                  check (value_type in ('text','textarea','boolean','number','money_cents','url','email','phone','select')),
  options       jsonb check (options is null or jsonb_typeof(options) = 'array'),
  value         jsonb not null default 'null'::jsonb,
  default_value jsonb,
  -- The split between what the storefront may read and what stays admin-only.
  -- This is a column rather than a convention precisely so a future
  -- integrations.courier_api_key is unreadable by anon at the database.
  is_public     boolean not null default true,
  is_locked     boolean not null default false,
  position      integer not null default 100,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id) on delete set null
);

comment on table public.site_settings is
  'Values the owner must be able to change without a deploy. The shipping rule that place_order charges lives HERE, not in a TypeScript constant, so the number shown and the number charged cannot drift.';

create index if not exists site_settings_group_idx on public.site_settings (group_key, position);
create index if not exists site_settings_public_idx on public.site_settings (key) where is_public;

drop trigger if exists trg_site_settings_updated_at on public.site_settings;
create trigger trg_site_settings_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

-- The client IS the admin, so table grants alone cannot stop a structural edit
-- that would break checkout arithmetic. Values stay freely editable; the
-- schema of a locked row is frozen. Unlocking is a deliberate SQL-editor act.
create or replace function public.tg_settings_lock_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- OLD does not exist on INSERT, so the lock branch is UPDATE-only.
  if tg_op = 'UPDATE' and old.is_locked then
    if new.key <> old.key
       or new.value_type <> old.value_type
       or new.is_public is distinct from old.is_public
       or new.group_key <> old.group_key then
      raise exception 'Setting % is locked: its key, type, group and visibility cannot be changed from the app.', old.key
        using errcode = '23514';
    end if;
  end if;
  -- Anything in the integrations group is secret by definition. This runs on
  -- INSERT as well: is_public DEFAULTS TO TRUE and the admin insert policy only
  -- checks is_admin(), so an owner adding integrations.courier_api_key from the
  -- settings screen would otherwise publish it to anon on the very first write,
  -- with no update ever occurring to correct it.
  if new.group_key = 'integrations' then
    new.is_public := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_site_settings_lock_guard on public.site_settings;
create trigger trg_site_settings_lock_guard
  before insert or update on public.site_settings
  for each row execute function public.tg_settings_lock_guard();

-- Belt and braces: the trigger normalises, the CHECK makes the invariant true
-- of the table itself, so it survives a future migration that replaces the
-- trigger, a COPY, or a write by service_role (which triggers do bind, but a
-- disabled trigger does not). Existing rows are normalised first so the
-- constraint can be added to a database seeded before this fix.
update public.site_settings
   set is_public = false
 where group_key = 'integrations' and is_public;

do $$
begin
  alter table public.site_settings
    add constraint site_settings_integrations_private
    check (group_key <> 'integrations' or is_public = false);
exception
  when duplicate_object then null;
  when duplicate_table  then null;
end
$$;

alter table public.site_settings enable row level security;

drop policy if exists site_settings_public_read  on public.site_settings;
drop policy if exists site_settings_admin_insert on public.site_settings;
drop policy if exists site_settings_admin_update on public.site_settings;
drop policy if exists site_settings_admin_delete on public.site_settings;

-- Non-public rows are simply absent from the response. There is no 403 to
-- probe and no way to enumerate the private keys.
create policy site_settings_public_read on public.site_settings
  for select to anon, authenticated
  using (is_public or (select public.is_admin()));

create policy site_settings_admin_insert on public.site_settings
  for insert to authenticated with check ((select public.is_admin()));
create policy site_settings_admin_update on public.site_settings
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy site_settings_admin_delete on public.site_settings
  for delete to authenticated using ((select public.is_admin()));

grant select on public.site_settings to anon;
grant select, insert, update, delete on public.site_settings to authenticated;

-- -----------------------------------------------------------------------------
-- Setting accessors
-- -----------------------------------------------------------------------------
-- TWO FAMILIES, AND THE DIFFERENCE IS THE WHOLE POINT.
--
--   *_private()   SECURITY DEFINER with EXECUTE granted to nobody. They read
--                 any row regardless of is_public, and exist for the SECURITY
--                 DEFINER RPCs in 0006 that must see a secret to do their job
--                 (integrations.throttle_salt, checkout.rate_limit_per_hour).
--                 Because no application role may execute them, they are not
--                 reachable through PostgREST at all.
--
--   the public 3  Also SECURITY DEFINER — so the shipping rule stays
--                 authoritative — but they RE-APPLY the visibility rule from
--                 site_settings_public_read: a row with is_public = false is
--                 invisible unless the caller is an admin. Without that filter
--                 these three would be a read-any-setting oracle for anon
--                 (rpc/setting_text?p_key=integrations.courier_api_key) and
--                 would defeat the entire purpose of the is_public column.
--
-- All six return the supplied default when the row is missing — or, for the
-- public three, when it is hidden — so a half-seeded database still takes
-- orders and a private key never leaks even as a "value not found" signal.
-- -----------------------------------------------------------------------------

create or replace function public.setting_int_private(p_key text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select nullif(s.value #>> '{}', '')::integer
       from public.site_settings s where s.key = p_key),
    p_default);
$$;

create or replace function public.setting_bool_private(p_key text, p_default boolean)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select nullif(s.value #>> '{}', '')::boolean
       from public.site_settings s where s.key = p_key),
    p_default);
$$;

create or replace function public.setting_text_private(p_key text, p_default text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select nullif(s.value #>> '{}', '')
       from public.site_settings s where s.key = p_key),
    p_default);
$$;

-- Callable only by the function owner, i.e. only from inside another SECURITY
-- DEFINER function in this schema.
revoke execute on function public.setting_int_private(text, integer)  from public, anon, authenticated;
revoke execute on function public.setting_bool_private(text, boolean) from public, anon, authenticated;
revoke execute on function public.setting_text_private(text, text)    from public, anon, authenticated;

create or replace function public.setting_int(p_key text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select nullif(s.value #>> '{}', '')::integer
       from public.site_settings s
      where s.key = p_key
        and (s.is_public or public.is_admin())),
    p_default);
$$;

create or replace function public.setting_bool(p_key text, p_default boolean)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select nullif(s.value #>> '{}', '')::boolean
       from public.site_settings s
      where s.key = p_key
        and (s.is_public or public.is_admin())),
    p_default);
$$;

create or replace function public.setting_text(p_key text, p_default text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select nullif(s.value #>> '{}', '')
       from public.site_settings s
      where s.key = p_key
        and (s.is_public or public.is_admin())),
    p_default);
$$;

comment on function public.setting_text(text, text) is
  'Public setting reader. Honours is_public exactly as the RLS policy does; private keys read as the caller-supplied default. Internal callers that need a private value use setting_text_private().';

revoke execute on function public.setting_int(text, integer)  from public;
revoke execute on function public.setting_bool(text, boolean) from public;
revoke execute on function public.setting_text(text, text)    from public;
grant  execute on function public.setting_int(text, integer)  to anon, authenticated;
grant  execute on function public.setting_bool(text, boolean) to anon, authenticated;
grant  execute on function public.setting_text(text, text)    to anon, authenticated;
