-- =============================================================================
-- 0009_seed_cms.sql
-- FEATURE: Seeds the CMS so the admin opens onto the copy that is on the site
--          today rather than onto empty boxes, and seeds the labelled site
--          settings that replace the hardcoded values in src/lib/constants.ts.
--
-- SAFE TO RE-RUN: yes, and non-destructive. Every statement is
--          ON CONFLICT DO NOTHING, so re-running never clobbers an edit the
--          client has made. To reset a block to these defaults, delete the row
--          and re-run this file.
--
-- HOW THE ADMIN FORM WORKS: each row's `fields` column is the form schema —
--          an ordered array of {name,label,help,type,...}. The admin renders
--          one generic form-from-schema driver against it, so the client sees
--          "Headline", "Hero image", "Button text" and never a raw JSON box.
--          Dotted names ("primaryCta.label") address nested keys inside
--          payload. The pseudo-name "$root" means the payload itself is the
--          value (used by the marquee, whose payload is a JSON array).
--          Adding a field to an existing block is an UPDATE, not a migration.
--
--          Rows seeded here are is_locked = true: the client can edit the
--          content freely, but not the schema, which would desynchronise the
--          stored payload from the React component that renders it.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Home page blocks (keys match src/lib/cms/defaults.ts -> HomeContent)
-- ---------------------------------------------------------------------------

insert into public.content_blocks (page, key, label, help, payload, fields, is_locked, published, position)
values ('home', 'banner_1', 'Home banner 1', 'The first slide of the banner at the top of the home page. Unpublish it to drop it from the rotation.',
        '{"image": "/banners/banner-ties.webp", "imageAlt": "Silk neckties in burgundy, olive, black and gold laid across dark polished walnut", "eyebrow": "The Art of Modern Man", "title": "Woven silk, cut to a modern blade", "lede": "Neckties chosen for how they hold a knot and how they fall. Delivered islandwide, usually within three days.", "cta": {"href": "/collections/neckties", "label": "Shop Neckties"}}'::jsonb,
        '[{"name": "image", "label": "Banner image", "type": "image", "required": true, "help": "Wide, roughly 2000 by 1000. Keep the LEFT side dark and empty - the headline sits there."}, {"name": "imageAlt", "label": "Image description (for screen readers)", "type": "text", "required": true, "max_length": 200}, {"name": "eyebrow", "label": "Small line above the headline", "type": "text", "max_length": 60}, {"name": "title", "label": "Headline", "type": "text", "required": true, "max_length": 70}, {"name": "lede", "label": "Supporting line", "type": "textarea", "max_length": 200, "rows": 3}, {"name": "cta.label", "label": "Button text", "type": "text", "max_length": 30}, {"name": "cta.href", "label": "Button link", "type": "link"}]'::jsonb,
        true, true, 1)
on conflict (page, key) do nothing;

insert into public.content_blocks (page, key, label, help, payload, fields, is_locked, published, position)
values ('home', 'banner_2', 'Home banner 2', 'The second slide of the banner at the top of the home page. Unpublish it to show only banner 1.',
        '{"image": "/banners/banner-cufflinks.webp", "imageAlt": "Silver cufflinks and a matching tie clip in a burgundy presentation case", "eyebrow": "Finishing details", "title": "The small things people notice", "lede": "Cufflinks and clips in premium metal alloy, gift boxed and ready to hand over.", "cta": {"href": "/collections/cufflinks", "label": "Shop Cufflinks"}}'::jsonb,
        '[{"name": "image", "label": "Banner image", "type": "image", "required": true, "help": "Wide, roughly 2000 by 1000. Keep the LEFT side dark and empty - the headline sits there."}, {"name": "imageAlt", "label": "Image description (for screen readers)", "type": "text", "required": true, "max_length": 200}, {"name": "eyebrow", "label": "Small line above the headline", "type": "text", "max_length": 60}, {"name": "title", "label": "Headline", "type": "text", "required": true, "max_length": 70}, {"name": "lede", "label": "Supporting line", "type": "textarea", "max_length": 200, "rows": 3}, {"name": "cta.label", "label": "Button text", "type": "text", "max_length": 30}, {"name": "cta.href", "label": "Button link", "type": "link"}]'::jsonb,
        true, true, 2)
on conflict (page, key) do nothing;

insert into public.content_blocks (page, key, label, help, payload, fields, is_locked, published, position)
values ('home', 'showcase', 'Shop our categories', 'The two large collection cards directly beneath the banner. Each card takes its own image.',
        '{"eyebrow": "Franley luxury", "title": "Shop our categories", "lede": "Browse our handcrafted collections, made for modern elegance and timeless style.", "card1": {"href": "/collections/neckties", "image": "/editorial/cat-neckties.webp", "imageAlt": "A burgundy silk necktie rolled on a dark wooden surface", "kicker": "Curated elegance", "name": "Neckties", "accent": "wine"}, "card2": {"href": "/collections/cufflinks", "image": "/editorial/cat-cufflinks.webp", "imageAlt": "Ornate gold cufflinks resting on dark navy cloth", "kicker": "Bespoke details", "name": "Cufflinks", "accent": "champagne"}}'::jsonb,
        '[{"name": "eyebrow", "label": "Small line above the title", "type": "text", "max_length": 60}, {"name": "title", "label": "Title", "type": "text", "required": true, "max_length": 80}, {"name": "lede", "label": "Intro line", "type": "textarea", "max_length": 240, "rows": 2}, {"name": "card1.image", "label": "Card 1 image (left)", "type": "image", "required": true}, {"name": "card1.imageAlt", "label": "Card 1 image description", "type": "text", "required": true, "max_length": 200}, {"name": "card1.kicker", "label": "Card 1 small label", "type": "text", "max_length": 40}, {"name": "card1.name", "label": "Card 1 heading", "type": "text", "required": true, "max_length": 40}, {"name": "card1.href", "label": "Card 1 link", "type": "link"}, {"name": "card2.image", "label": "Card 2 image (right)", "type": "image", "required": true}, {"name": "card2.imageAlt", "label": "Card 2 image description", "type": "text", "required": true, "max_length": 200}, {"name": "card2.kicker", "label": "Card 2 small label", "type": "text", "max_length": 40}, {"name": "card2.name", "label": "Card 2 heading", "type": "text", "required": true, "max_length": 40}, {"name": "card2.href", "label": "Card 2 link", "type": "link"}]'::jsonb,
        true, true, 3)
on conflict (page, key) do nothing;

insert into public.content_blocks (page, key, label, help, payload, fields, is_locked, published, position)
values ('home', 'editorial', 'Editorial band', 'The story band with the two stacked photographs.',
        '{"eyebrow": "The Franley standard", "title": "The Art of Modern Man", "subtitle": "Signature Collection", "body": "Every Franley tie starts as a bolt of micro-textured fabric chosen for how it holds a knot. It is cut on the bias so the blade falls straight, backed with a soft interlining that gives without creasing, and closed with a hand slip stitch that lets the tie recover its shape overnight. The result is a piece that looks the same on its hundredth wearing as on its first.", "cta": {"href": "/about", "label": "Read our story"}, "videoLarge": "/video/tie-adjust.mp4", "videoLargePoster": "/video/tie-adjust-poster.webp", "imageLarge": "/editorial/desk-ties.webp", "imageLargeAlt": "A man fastening a burgundy silk tie at the collar", "imageSmall": "/editorial/cuff-detail.webp", "imageSmallAlt": "A silver cufflink with a burgundy inlay fastened through a white cuff"}'::jsonb,
        '[{"name": "eyebrow", "label": "Small line above the title", "type": "text", "max_length": 60}, {"name": "title", "label": "Title", "type": "text", "required": true, "max_length": 60}, {"name": "subtitle", "label": "Subtitle", "type": "text", "max_length": 60}, {"name": "body", "label": "Body copy", "type": "textarea", "max_length": 1200, "rows": 8}, {"name": "cta.label", "label": "Link text", "type": "text", "max_length": 30}, {"name": "cta.href", "label": "Link target", "type": "link"}, {"name": "videoLarge", "label": "Large frame video", "type": "text", "help": "Optional. A short silent clip that plays in place of the large image. Leave empty to use the image."}, {"name": "videoLargePoster", "label": "Video still image", "type": "image", "help": "Shown before the clip loads, and instead of it for visitors who prefer reduced motion."}, {"name": "imageLarge", "label": "Large image", "type": "image"}, {"name": "imageLargeAlt", "label": "Large image description", "type": "text", "required": true, "max_length": 200}, {"name": "imageSmall", "label": "Small image", "type": "image"}, {"name": "imageSmallAlt", "label": "Small image description", "type": "text", "required": true, "max_length": 200}]'::jsonb,
        true, true, 4)
on conflict (page, key) do nothing;

insert into public.content_blocks (page, key, label, help, payload, fields, is_locked, published, position)
values ('home', 'marquee', 'Scrolling promise strip', 'The four short phrases that scroll across the burgundy strip. Plain text, no links.',
        '["Premium Quality Materials", "Islandwide Delivery", "Secure Online Payments", "Fast WhatsApp Support"]'::jsonb,
        '[{"name": "$root", "label": "Phrases", "type": "string_list", "max_items": 8, "max_length": 40, "help": "One short phrase per line. Four reads best."}]'::jsonb,
        true, true, 5)
on conflict (page, key) do nothing;

insert into public.content_blocks (page, key, label, help, payload, fields, is_locked, published, position)
values ('home', 'collection', 'Collection band heading', 'The heading above the product grid.',
        '{"eyebrow": "The Collection", "title": "Pieces worth the knot", "lede": "A tight, considered range - solids that go with everything and stripes that do the talking."}'::jsonb,
        '[{"name": "eyebrow", "label": "Small line above the title", "type": "text", "max_length": 60}, {"name": "title", "label": "Title", "type": "text", "required": true, "max_length": 80}, {"name": "lede", "label": "Intro line", "type": "textarea", "max_length": 240, "rows": 2}]'::jsonb,
        true, true, 6)
on conflict (page, key) do nothing;

insert into public.content_blocks (page, key, label, help, payload, fields, is_locked, published, position)
values ('home', 'lookbook', 'New arrivals heading', 'The heading above the new-arrivals rail.',
        '{"eyebrow": "Just in", "title": "New this season", "lede": "The latest additions to the range - worth a look before they move."}'::jsonb,
        '[{"name": "eyebrow", "label": "Small line above the title", "type": "text", "max_length": 60}, {"name": "title", "label": "Title", "type": "text", "required": true, "max_length": 80}, {"name": "lede", "label": "Intro line", "type": "textarea", "max_length": 240, "rows": 2}]'::jsonb,
        true, true, 7)
on conflict (page, key) do nothing;

insert into public.content_blocks (page, key, label, help, payload, fields, is_locked, published, position)
values ('global', 'announcement', 'Announcement bar', 'The thin strip at the very top of every page. Turn it off with the Published switch, or schedule it with the publish dates.',
        '{"text": "Free islandwide delivery on orders over Rs 5,000.", "href": "/shop", "linkLabel": "Shop now"}'::jsonb,
        '[{"name": "text", "label": "Message", "type": "text", "required": true, "max_length": 120}, {"name": "linkLabel", "label": "Link text", "type": "text", "max_length": 30}, {"name": "href", "label": "Link target", "type": "link"}]'::jsonb,
        true, false, 1)
on conflict (page, key) do nothing;


-- ---------------------------------------------------------------------------
-- Site settings. value and default_value are the same at seed time, so the
-- admin can offer a "reset to default" button.
-- ---------------------------------------------------------------------------

insert into public.site_settings (key, group_key, label, help, value_type, value, default_value, is_public, is_locked, position)
values ('store.name', 'store', 'Store name', 'Shown in the browser tab and the header.', 'text', '"Franley"'::jsonb, '"Franley"'::jsonb, true, true, 1)
on conflict (key) do nothing;

insert into public.site_settings (key, group_key, label, help, value_type, value, default_value, is_public, is_locked, position)
values ('store.tagline', 'store', 'Tagline', null, 'text', '"Individual Men''s Neckwear"'::jsonb, '"Individual Men''s Neckwear"'::jsonb, true, false, 2)
on conflict (key) do nothing;

insert into public.site_settings (key, group_key, label, help, value_type, value, default_value, is_public, is_locked, position)
values ('store.currency', 'store', 'Currency', 'Locked. The whole schema stores money as LKR cents.', 'text', '"LKR"'::jsonb, '"LKR"'::jsonb, true, true, 3)
on conflict (key) do nothing;

insert into public.site_settings (key, group_key, label, help, value_type, value, default_value, is_public, is_locked, position)
values ('contact.phone', 'contact', 'Phone number', 'Shown in the footer and on the contact page.', 'phone', '"+94 77 000 0000"'::jsonb, '"+94 77 000 0000"'::jsonb, true, false, 10)
on conflict (key) do nothing;

insert into public.site_settings (key, group_key, label, help, value_type, value, default_value, is_public, is_locked, position)
values ('contact.whatsapp', 'contact', 'WhatsApp number', 'Used by the floating WhatsApp button. Include the country code, digits only.', 'phone', '"+94770000000"'::jsonb, '"+94770000000"'::jsonb, true, false, 11)
on conflict (key) do nothing;

insert into public.site_settings (key, group_key, label, help, value_type, value, default_value, is_public, is_locked, position)
values ('contact.email', 'contact', 'Contact email', null, 'email', '"hello@franley.lk"'::jsonb, '"hello@franley.lk"'::jsonb, true, false, 12)
on conflict (key) do nothing;

insert into public.site_settings (key, group_key, label, help, value_type, value, default_value, is_public, is_locked, position)
values ('shipping.flat_rate_cents', 'shipping', 'Delivery charge (cents)', 'In cents: 35000 = Rs 350.00. This is the number the checkout actually charges.', 'money_cents', '35000'::jsonb, '35000'::jsonb, true, true, 20)
on conflict (key) do nothing;

insert into public.site_settings (key, group_key, label, help, value_type, value, default_value, is_public, is_locked, position)
values ('shipping.free_threshold_cents', 'shipping', 'Free delivery over (cents)', 'In cents: 500000 = Rs 5,000.00. Orders at or above this ship free.', 'money_cents', '500000'::jsonb, '500000'::jsonb, true, true, 21)
on conflict (key) do nothing;

insert into public.site_settings (key, group_key, label, help, value_type, value, default_value, is_public, is_locked, position)
values ('checkout.enabled', 'checkout', 'Accept orders', 'Turn this off to close checkout without taking the site down.', 'boolean', 'true'::jsonb, 'true'::jsonb, true, true, 30)
on conflict (key) do nothing;

insert into public.site_settings (key, group_key, label, help, value_type, value, default_value, is_public, is_locked, position)
values ('checkout.max_line_quantity', 'checkout', 'Max quantity per product', null, 'number', '10'::jsonb, '10'::jsonb, true, true, 31)
on conflict (key) do nothing;

insert into public.site_settings (key, group_key, label, help, value_type, value, default_value, is_public, is_locked, position)
values ('checkout.max_lines', 'checkout', 'Max different products per order', null, 'number', '20'::jsonb, '20'::jsonb, true, true, 32)
on conflict (key) do nothing;

insert into public.site_settings (key, group_key, label, help, value_type, value, default_value, is_public, is_locked, position)
values ('checkout.rate_limit_per_hour', 'checkout', 'Checkout attempts allowed per hour', 'Abuse brake. Not shown to shoppers.', 'number', '8'::jsonb, '8'::jsonb, false, true, 33)
on conflict (key) do nothing;

insert into public.site_settings (key, group_key, label, help, value_type, value, default_value, is_public, is_locked, position)
values ('checkout.lookup_limit_per_hour', 'checkout', 'Order-link lookups allowed per hour', 'Abuse brake on the "track my order" page. Shared by every shopper when the page renders server-side, so keep it generous. Not shown to shoppers.', 'number', '600'::jsonb, '600'::jsonb, false, true, 34)
on conflict (key) do nothing;

insert into public.site_settings (key, group_key, label, help, value_type, value, default_value, is_public, is_locked, position)
values ('payment.bank_transfer_details', 'payment', 'Bank transfer instructions', 'Shown at checkout when the shopper picks bank transfer.', 'textarea', '"Bank: —\nAccount name: —\nAccount number: —\nSend the deposit slip to our WhatsApp number."'::jsonb, '"Bank: —\nAccount name: —\nAccount number: —\nSend the deposit slip to our WhatsApp number."'::jsonb, true, false, 40)
on conflict (key) do nothing;

insert into public.site_settings (key, group_key, label, help, value_type, value, default_value, is_public, is_locked, position)
values ('social.instagram', 'social', 'Instagram URL', null, 'url', '""'::jsonb, '""'::jsonb, true, false, 50)
on conflict (key) do nothing;

insert into public.site_settings (key, group_key, label, help, value_type, value, default_value, is_public, is_locked, position)
values ('social.facebook', 'social', 'Facebook URL', null, 'url', '""'::jsonb, '""'::jsonb, true, false, 51)
on conflict (key) do nothing;

insert into public.site_settings (key, group_key, label, help, value_type, value, default_value, is_public, is_locked, position)
values ('seo.default_title', 'seo', 'Default page title', null, 'text', '"Franley — Individual Men''s Neckwear"'::jsonb, '"Franley — Individual Men''s Neckwear"'::jsonb, true, false, 60)
on conflict (key) do nothing;

insert into public.site_settings (key, group_key, label, help, value_type, value, default_value, is_public, is_locked, position)
values ('seo.default_description', 'seo', 'Default meta description', null, 'textarea', '"Premium neckties, cufflinks and finishing pieces. Delivered islandwide across Sri Lanka."'::jsonb, '"Premium neckties, cufflinks and finishing pieces. Delivered islandwide across Sri Lanka."'::jsonb, true, false, 61)
on conflict (key) do nothing;

insert into public.site_settings (key, group_key, label, help, value_type, value, default_value, is_public, is_locked, position)
values ('integrations.throttle_salt', 'integrations', 'Rate-limit salt', 'Salts the hashes in checkout_throttle. Never public. Change it once, then leave it alone.', 'text', '"change-me-to-a-random-string"'::jsonb, '"change-me-to-a-random-string"'::jsonb, false, true, 70)
on conflict (key) do nothing;


do $$
declare b int; s int;
begin
  select count(*) into b from public.content_blocks;
  select count(*) into s from public.site_settings;
  raise notice 'Franley CMS: % content blocks, % settings', b, s;
  raise notice 'Remember to change integrations.throttle_salt to a random string.';
end
$$;
