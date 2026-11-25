-- =============================================================================
-- 0019_tie_categories.sql
-- FEATURE: Two more kinds of necktie, listed under Neckties beside Plain and
--          Stripes:
--            * Modern ties  — the slimmer blade
--            * Regular ties — a blade wider than 7.5 cm
--          Products are moved into them from Admin -> Products (Category).
--
-- SAFE TO RE-RUN: yes. ON CONFLICT ... DO NOTHING, so a re-run never
--          overwrites a name or description changed later in the admin.
-- =============================================================================

insert into public.categories (slug, name, description, parent_id, position, is_active)
select 'modern-ties', 'Modern ties', 'Slimmer modern-cut neckties for a sharp, contemporary knot.', p.id, 4, true
  from public.categories p where p.slug = 'neckties'
on conflict (slug) do nothing;

insert into public.categories (slug, name, description, parent_id, position, is_active)
select 'regular-ties', 'Regular ties', 'Classic-width neckties, wider than 7.5 cm.', p.id, 5, true
  from public.categories p where p.slug = 'neckties'
on conflict (slug) do nothing;

do $$
begin
  raise notice '0019 applied: Modern ties and Regular ties are under Neckties.';
end
$$;
