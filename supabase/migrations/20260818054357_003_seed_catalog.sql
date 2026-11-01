/*
# Seed default categories and sample products

1. Overview
   - Inserts the default category tree (Bedding, Cushions, Pillows, Custom Products) with subcategories.
   - Inserts 5 sample products based on the owner's provided data, each with a variant matching the given size/weight/fabric/price.
   - Product names, colors, designs, stitching are intentionally left generic (e.g. "Handmade Cotton Lahaf") since the owner must enter exact details via the admin UI.
   - Uses ON CONFLICT DO NOTHING so re-running is safe.

2. Notes
   - These are real catalog entries (not fake orders/payments/customers), so they are legitimate seed data the owner can edit or delete.
*/

INSERT INTO public.categories (name, slug, sort_order) VALUES
  ('Bedding', 'bedding', 1),
  ('Cushions', 'cushions', 2),
  ('Pillows', 'pillows', 3),
  ('Custom Products', 'custom-products', 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.categories (name, slug, parent_id, sort_order)
SELECT 'Lahaf', 'lahaf', c.id, 1 FROM public.categories c WHERE c.slug = 'bedding'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (name, slug, parent_id, sort_order)
SELECT 'Razai', 'razai', c.id, 2 FROM public.categories c WHERE c.slug = 'bedding'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (name, slug, parent_id, sort_order)
SELECT 'Gadda', 'gadda', c.id, 3 FROM public.categories c WHERE c.slug = 'bedding'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (name, slug, parent_id, sort_order)
SELECT 'Mattress', 'mattress', c.id, 4 FROM public.categories c WHERE c.slug = 'bedding'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (name, slug, parent_id, sort_order)
SELECT 'Quilt', 'quilt', c.id, 5 FROM public.categories c WHERE c.slug = 'bedding'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (name, slug, parent_id, sort_order)
SELECT 'Comforter', 'comforter', c.id, 6 FROM public.categories c WHERE c.slug = 'bedding'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (name, slug, parent_id, sort_order)
SELECT 'Bedding Set', 'bedding-set', c.id, 7 FROM public.categories c WHERE c.slug = 'bedding'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.categories (name, slug, parent_id, sort_order)
SELECT 'Cushion', 'cushion', c.id, 1 FROM public.categories c WHERE c.slug = 'cushions'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (name, slug, parent_id, sort_order)
SELECT 'Floor Cushion', 'floor-cushion', c.id, 2 FROM public.categories c WHERE c.slug = 'cushions'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (name, slug, parent_id, sort_order)
SELECT 'Sofa Cushion', 'sofa-cushion', c.id, 3 FROM public.categories c WHERE c.slug = 'cushions'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (name, slug, parent_id, sort_order)
SELECT 'Decorative Cushion', 'decorative-cushion', c.id, 4 FROM public.categories c WHERE c.slug = 'cushions'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (name, slug, parent_id, sort_order)
SELECT 'Bolster', 'bolster', c.id, 5 FROM public.categories c WHERE c.slug = 'cushions'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.categories (name, slug, parent_id, sort_order)
SELECT 'Cotton Pillow', 'cotton-pillow', c.id, 1 FROM public.categories c WHERE c.slug = 'pillows'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (name, slug, parent_id, sort_order)
SELECT 'Fiber Pillow', 'fiber-pillow', c.id, 2 FROM public.categories c WHERE c.slug = 'pillows'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (name, slug, parent_id, sort_order)
SELECT 'Handmade Pillow', 'handmade-pillow', c.id, 3 FROM public.categories c WHERE c.slug = 'pillows'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (name, slug, parent_id, sort_order)
SELECT 'Custom Pillow', 'custom-pillow', c.id, 4 FROM public.categories c WHERE c.slug = 'pillows'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.categories (name, slug, parent_id, sort_order)
SELECT 'Custom Lahaf', 'custom-lahaf', c.id, 1 FROM public.categories c WHERE c.slug = 'custom-products'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (name, slug, parent_id, sort_order)
SELECT 'Custom Razai', 'custom-razai', c.id, 2 FROM public.categories c WHERE c.slug = 'custom-products'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (name, slug, parent_id, sort_order)
SELECT 'Custom Gadda', 'custom-gadda', c.id, 3 FROM public.categories c WHERE c.slug = 'custom-products'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (name, slug, parent_id, sort_order)
SELECT 'Custom Cushion', 'custom-cushion', c.id, 4 FROM public.categories c WHERE c.slug = 'custom-products'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (name, slug, parent_id, sort_order)
SELECT 'Custom Bedding Set', 'custom-bedding-set', c.id, 5 FROM public.categories c WHERE c.slug = 'custom-products'
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.categories (name, slug, parent_id, sort_order)
SELECT 'Custom Cotton Product', 'custom-cotton-product', c.id, 6 FROM public.categories c WHERE c.slug = 'custom-products'
ON CONFLICT (slug) DO NOTHING;

-- Sample products
DO $$
DECLARE
  lahaf_cat uuid;
  pillow_cat uuid;
  p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid;
BEGIN
  SELECT id INTO lahaf_cat FROM public.categories WHERE slug = 'lahaf' LIMIT 1;
  SELECT id INTO pillow_cat FROM public.categories WHERE slug = 'fiber-pillow' LIMIT 1;

  INSERT INTO public.products (name, slug, sku, category_id, short_desc, full_desc, price, currency, status, stock, handmade, customizable, production_time, handmade_info, care_instructions)
  VALUES ('Handmade Cotton Lahaf', 'handmade-cotton-lahaf-60x94', 'HLF-6094', lahaf_cat, 'Handmade cotton lahaf, 60 x 94 inches, 4 kg.', 'Traditional handmade cotton lahaf crafted with pure cotton filling and cotton fabric. Size 60 x 94 inches, weight 4 kg.', 3200, 'PKR', 'active', 10, true, true, '3-7 days', 'Handmade product. Minor variations in size, color, and stitching may occur due to hand production.', 'Sun dry. Do not bleach. Store in dry place.')
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO p1;

  INSERT INTO public.products (name, slug, sku, category_id, short_desc, full_desc, price, currency, status, stock, handmade, customizable, production_time, handmade_info, care_instructions)
  VALUES ('Handmade Cotton Lahaf', 'handmade-cotton-lahaf-60x96', 'HLF-6096', lahaf_cat, 'Handmade cotton lahaf, 60 x 96 inches, 4 kg.', 'Traditional handmade cotton lahaf crafted with pure cotton filling and cotton fabric. Size 60 x 96 inches, weight 4 kg.', 4200, 'PKR', 'active', 6, true, true, '3-7 days', 'Handmade product. Minor variations in size, color, and stitching may occur due to hand production.', 'Sun dry. Do not bleach. Store in dry place.')
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO p2;

  INSERT INTO public.products (name, slug, sku, category_id, short_desc, full_desc, price, currency, status, stock, handmade, customizable, production_time, handmade_info, care_instructions)
  VALUES ('Handmade Cotton Lahaf', 'handmade-cotton-lahaf-48x80', 'HLF-4880', lahaf_cat, 'Handmade cotton lahaf, 48 x 80 inches, 4 kg.', 'Traditional handmade cotton lahaf crafted with pure cotton filling and cotton fabric. Size 48 x 80 inches, weight 4 kg.', 3000, 'PKR', 'active', 12, true, true, '3-7 days', 'Handmade product. Minor variations in size, color, and stitching may occur due to hand production.', 'Sun dry. Do not bleach. Store in dry place.')
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO p3;

  INSERT INTO public.products (name, slug, sku, category_id, short_desc, full_desc, price, currency, status, stock, handmade, customizable, production_time, handmade_info, care_instructions)
  VALUES ('Handmade Cotton Lahaf', 'handmade-cotton-lahaf-52x85', 'HLF-5285', lahaf_cat, 'Handmade cotton lahaf, 52 x 85 inches, 4 kg.', 'Traditional handmade cotton lahaf crafted with pure cotton filling and cotton fabric. Size 52 x 85 inches, weight 4 kg.', 3600, 'PKR', 'active', 8, true, true, '3-7 days', 'Handmade product. Minor variations in size, color, and stitching may occur due to hand production.', 'Sun dry. Do not bleach. Store in dry place.')
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO p4;

  INSERT INTO public.products (name, slug, sku, category_id, short_desc, full_desc, price, currency, status, stock, handmade, customizable, production_time, handmade_info, care_instructions)
  VALUES ('White Fiber Lahaf', 'white-fiber-lahaf-48x80', 'WFL-4880', lahaf_cat, 'White fiber lahaf, 48 x 80 inches, 2 kg.', 'Lightweight white fiber lahaf with white fiber filling and fabric. Size 48 x 80 inches, weight 2 kg.', 2200, 'PKR', 'active', 15, false, true, '2-5 days', 'Color variation may occur due to photography/display.', 'Sun dry. Do not bleach. Store in dry place.')
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO p5;

  -- Variants matching provided specs
  IF p1 IS NOT NULL THEN
    INSERT INTO public.product_variants (product_id, sku, price, size_label, width, length, unit, weight, filling, fabric, stock, active)
    VALUES (p1, 'HLF-6094-STD', 3200, '60 x 94', 60, 94, 'inches', '4 kg', 'Cotton', 'Cotton', 10, true);
  END IF;
  IF p2 IS NOT NULL THEN
    INSERT INTO public.product_variants (product_id, sku, price, size_label, width, length, unit, weight, filling, fabric, stock, active)
    VALUES (p2, 'HLF-6096-STD', 4200, '60 x 96', 60, 96, 'inches', '4 kg', 'Cotton', 'Cotton', 6, true);
  END IF;
  IF p3 IS NOT NULL THEN
    INSERT INTO public.product_variants (product_id, sku, price, size_label, width, length, unit, weight, filling, fabric, stock, active)
    VALUES (p3, 'HLF-4880-STD', 3000, '48 x 80', 48, 80, 'inches', '4 kg', 'Cotton', 'Cotton', 12, true);
  END IF;
  IF p4 IS NOT NULL THEN
    INSERT INTO public.product_variants (product_id, sku, price, size_label, width, length, unit, weight, filling, fabric, stock, active)
    VALUES (p4, 'HLF-5285-STD', 3600, '52 x 85', 52, 85, 'inches', '4 kg', 'Cotton', 'Cotton', 8, true);
  END IF;
  IF p5 IS NOT NULL THEN
    INSERT INTO public.product_variants (product_id, sku, price, size_label, width, length, unit, weight, filling, fabric, stock, active)
    VALUES (p5, 'WFL-4880-STD', 2200, '48 x 80', 48, 80, 'inches', '2 kg', 'White Fiber', 'White Fiber Fabric', 15, true);
  END IF;
END $$;
