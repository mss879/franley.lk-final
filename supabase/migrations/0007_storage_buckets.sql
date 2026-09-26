-- =============================================================================
-- 0007_storage_buckets.sql
-- FEATURE: Two public Storage buckets and their policies, so the admin can
--          UPLOAD product photography and CMS banner imagery instead of only
--          referencing the seeded /products/*.webp files.
--
--            product-images  product photography
--            cms-media       hero / banner / editorial imagery
--
-- SAFE TO RE-RUN: yes. Buckets use ON CONFLICT DO NOTHING; policies are
--          dropped before being created; the whole storage section is wrapped
--          so that a permissions error (some CLI setups run migrations as a
--          role that does not own storage.objects) downgrades to a WARNING
--          telling you to add the policies from the dashboard, instead of
--          aborting the migration.
--
-- WHY PUBLIC BUCKETS: there is no secret in a photograph of a necktie, and
--          signed URLs defeat CDN caching and next/image optimisation for zero
--          security gain.
--
-- WHY THE MIME ALLOWLIST MATTERS MORE THAN THE POLICIES: a policy cannot check
--          content type; the bucket can. The allowlist is what stops a stolen
--          admin session uploading text/html into a public bucket and getting
--          stored XSS on the store's own origin.
-- =============================================================================

do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values
    ('product-images', 'product-images', true, 5242880,
      array['image/webp','image/jpeg','image/png','image/avif']),
    ('cms-media', 'cms-media', true, 5242880,
      array['image/webp','image/jpeg','image/png','image/avif'])
  on conflict (id) do nothing;
exception
  when insufficient_privilege then
    raise warning 'Could not create storage buckets (insufficient privilege). Create "product-images" and "cms-media" as PUBLIC buckets in Dashboard -> Storage, 5 MB limit, image/* only.';
  when undefined_table then
    raise warning 'storage.buckets not found — skipping. This is expected outside Supabase.';
end
$$;

-- -----------------------------------------------------------------------------
-- storage.objects policies
-- -----------------------------------------------------------------------------
-- Object keys are namespaced: products/<product_id>/<uuid>.webp and
-- cms/<uuid>.webp. The name regex in the INSERT/UPDATE policies is
-- path-traversal defence — without it the caller controls the object key and
-- can write outside its own prefix or overwrite another product's asset.
do $$
begin
  execute 'drop policy if exists franley_public_read_media on storage.objects';
  execute 'drop policy if exists franley_admin_read_media on storage.objects';
  execute 'drop policy if exists franley_admin_insert_media on storage.objects';
  execute 'drop policy if exists franley_admin_update_media on storage.objects';
  execute 'drop policy if exists franley_admin_delete_media on storage.objects';

  -- Admin only. Shoppers need no read policy: a public bucket serves
  -- /storage/v1/object/public/... without consulting RLS, while a public read
  -- policy would let anyone LIST the buckets, unreleased products included.
  -- Removing an object needs SELECT as well as DELETE, hence this policy.
  execute $p$
    create policy franley_admin_read_media on storage.objects
      for select to authenticated
      using (bucket_id in ('product-images', 'cms-media') and (select public.is_admin()))
  $p$;

  execute $p$
    create policy franley_admin_insert_media on storage.objects
      for insert to authenticated
      with check (
        bucket_id in ('product-images', 'cms-media')
        and (select public.is_admin())
        and name ~ '^(products/[0-9a-fA-F-]{36}/|cms/)[0-9a-zA-Z._-]{1,120}\.(webp|jpe?g|png|avif)$'
      )
  $p$;

  -- Both USING and WITH CHECK: without WITH CHECK an admin could rename an
  -- object into another bucket's namespace.
  execute $p$
    create policy franley_admin_update_media on storage.objects
      for update to authenticated
      using (bucket_id in ('product-images', 'cms-media') and (select public.is_admin()))
      with check (
        bucket_id in ('product-images', 'cms-media')
        and (select public.is_admin())
        and name ~ '^(products/[0-9a-fA-F-]{36}/|cms/)[0-9a-zA-Z._-]{1,120}\.(webp|jpe?g|png|avif)$'
      )
  $p$;

  execute $p$
    create policy franley_admin_delete_media on storage.objects
      for delete to authenticated
      using (bucket_id in ('product-images', 'cms-media') and (select public.is_admin()))
  $p$;
exception
  when insufficient_privilege then
    raise warning 'Could not create storage.objects policies (insufficient privilege). Add them from Dashboard -> Storage -> Policies: SELECT/INSERT/UPDATE/DELETE on both buckets restricted to public.is_admin().';
  when undefined_table then
    raise warning 'storage.objects not found — skipping. This is expected outside Supabase.';
end
$$;

-- Deliberately NO grants on storage.buckets to anon/authenticated: buckets are
-- created by migration only, so nobody can flip one to public/private or widen
-- its mime allowlist through the API.
