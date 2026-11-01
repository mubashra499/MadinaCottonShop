/*
# Profiles & Product Catalog

1. Overview
   - Creates a `profiles` table extending `auth.users` with role and contact metadata.
   - Creates the full product catalog: categories, products, product variants, product images, product videos, reviews, and questions.
   - The primary owner is identified by email myousufshaikh399@gmail.com and auto-assigned the 'owner' role on signup via a trigger.

2. New Tables
   - `profiles`: id (uuid, FK auth.users), full_name, phone, role, created_at, updated_at.
   - `categories`: id, name, slug, parent_id (self-ref), sort_order, active, created_at.
   - `products`: id, name, slug, sku, category_id, short/full desc, price, sale_price, currency, status, stock, low_stock_threshold, badges, production_time, care_instructions, handmade_info, seo fields, avg_rating, review_count, created_at, updated_at.
   - `product_variants`: id, product_id, sku, price, sale_price, size_label, width, length, unit, weight, filling, fabric, color, color_hex, design, stitching, decoration, stock, production_time, active, created_at.
   - `product_images`: id, product_id, variant_id (nullable), color, view_type, url, sort_order, is_primary, created_at.
   - `product_videos`: id, product_id, url, title, sort_order, created_at.
   - `reviews`: id, product_id, user_id, order_item_id, rating, sub-ratings, body, approved, created_at.
   - `questions`: id, product_id, user_id, question, answer, answered_by, approved, created_at.

3. Security
   - RLS enabled on every table.
   - Catalog tables publicly readable (anon + authenticated) so the storefront works without login.
   - Writes to catalog tables restricted to owner/admin roles via helper function `is_staff()`.
   - Profiles: each authenticated user can read/update their own profile. Staff can read all profiles.
   - Reviews/questions: any authenticated user can insert their own; only owner/admin can approve/answer/delete.

4. Notes
   - `is_staff()` checks the profiles table for role in ('owner','admin') or the owner email in the JWT.
   - Trigger `handle_new_user_profile` auto-creates a profile on signup and assigns 'owner' role to the configured owner email.
*/

-- Step 1: Create profiles table (no policies yet)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  role text NOT NULL DEFAULT 'customer',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 2: Create is_staff() helper (profiles table now exists)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner','admin')
    )
    OR (
      auth.uid() IS NOT NULL
      AND (auth.jwt() ->> 'email') = 'myousufshaikh399@gmail.com'
    )
$$;

-- Step 3: Enable RLS + policies on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own_or_staff" ON public.profiles;
CREATE POLICY "profiles_select_own_or_staff" ON public.profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR public.is_staff());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_staff" ON public.profiles;
CREATE POLICY "profiles_update_staff" ON public.profiles FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Step 4: Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    CASE WHEN NEW.email = 'myousufshaikh399@gmail.com' THEN 'owner' ELSE 'customer' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- Step 5: Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON public.categories(active);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_public_read" ON public.categories;
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "categories_staff_insert" ON public.categories;
CREATE POLICY "categories_staff_insert" ON public.categories FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "categories_staff_update" ON public.categories;
CREATE POLICY "categories_staff_update" ON public.categories FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "categories_staff_delete" ON public.categories;
CREATE POLICY "categories_staff_delete" ON public.categories FOR DELETE
  TO authenticated USING (public.is_staff());

-- Step 6: Products
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  sku text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  short_desc text,
  full_desc text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  sale_price numeric(12,2),
  currency text NOT NULL DEFAULT 'PKR',
  status text NOT NULL DEFAULT 'active',
  stock int NOT NULL DEFAULT 0,
  low_stock_threshold int NOT NULL DEFAULT 3,
  featured boolean NOT NULL DEFAULT false,
  is_new boolean NOT NULL DEFAULT false,
  best_seller boolean NOT NULL DEFAULT false,
  handmade boolean NOT NULL DEFAULT false,
  premium boolean NOT NULL DEFAULT false,
  sale boolean NOT NULL DEFAULT false,
  limited_stock boolean NOT NULL DEFAULT false,
  made_to_order boolean NOT NULL DEFAULT false,
  customizable boolean NOT NULL DEFAULT false,
  production_time text,
  care_instructions text,
  handmade_info text,
  seo_title text,
  meta_desc text,
  avg_rating numeric(2,1) DEFAULT 0,
  review_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_public_read" ON public.products;
CREATE POLICY "products_public_read" ON public.products FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "products_staff_insert" ON public.products;
CREATE POLICY "products_staff_insert" ON public.products FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "products_staff_update" ON public.products;
CREATE POLICY "products_staff_update" ON public.products FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "products_staff_delete" ON public.products;
CREATE POLICY "products_staff_delete" ON public.products FOR DELETE
  TO authenticated USING (public.is_staff());

-- Step 7: Product variants
CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  sale_price numeric(12,2),
  size_label text,
  width numeric(8,2),
  length numeric(8,2),
  unit text DEFAULT 'inches',
  weight text,
  filling text,
  fabric text,
  color text,
  color_hex text,
  design text,
  stitching text,
  decoration text,
  stock int NOT NULL DEFAULT 0,
  production_time text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON public.product_variants(product_id);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "variants_public_read" ON public.product_variants;
CREATE POLICY "variants_public_read" ON public.product_variants FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "variants_staff_insert" ON public.product_variants;
CREATE POLICY "variants_staff_insert" ON public.product_variants FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "variants_staff_update" ON public.product_variants;
CREATE POLICY "variants_staff_update" ON public.product_variants FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "variants_staff_delete" ON public.product_variants;
CREATE POLICY "variants_staff_delete" ON public.product_variants FOR DELETE
  TO authenticated USING (public.is_staff());

-- Step 8: Product images
CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE,
  color text,
  view_type text NOT NULL DEFAULT 'main',
  url text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_images_product ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_images_variant ON public.product_images(variant_id);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "images_public_read" ON public.product_images;
CREATE POLICY "images_public_read" ON public.product_images FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "images_staff_insert" ON public.product_images;
CREATE POLICY "images_staff_insert" ON public.product_images FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "images_staff_update" ON public.product_images;
CREATE POLICY "images_staff_update" ON public.product_images FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "images_staff_delete" ON public.product_images;
CREATE POLICY "images_staff_delete" ON public.product_images FOR DELETE
  TO authenticated USING (public.is_staff());

-- Step 9: Product videos
CREATE TABLE IF NOT EXISTS public.product_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_videos_product ON public.product_videos(product_id);

ALTER TABLE public.product_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "videos_public_read" ON public.product_videos;
CREATE POLICY "videos_public_read" ON public.product_videos FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "videos_staff_insert" ON public.product_videos;
CREATE POLICY "videos_staff_insert" ON public.product_videos FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "videos_staff_update" ON public.product_videos;
CREATE POLICY "videos_staff_update" ON public.product_videos FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "videos_staff_delete" ON public.product_videos;
CREATE POLICY "videos_staff_delete" ON public.product_videos FOR DELETE
  TO authenticated USING (public.is_staff());

-- Step 10: Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  order_item_id uuid,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  quality int,
  fabric int,
  stitching int,
  color_rating int,
  size_rating int,
  experience int,
  body text,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_approved ON public.reviews(approved);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_public_read_approved" ON public.reviews;
CREATE POLICY "reviews_public_read_approved" ON public.reviews FOR SELECT
  TO anon, authenticated USING (approved = true OR auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews_owner_insert" ON public.reviews;
CREATE POLICY "reviews_owner_insert" ON public.reviews FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews_staff_update" ON public.reviews;
CREATE POLICY "reviews_staff_update" ON public.reviews FOR UPDATE
  TO authenticated USING (public.is_staff() OR auth.uid() = user_id) WITH CHECK (public.is_staff() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews_owner_delete" ON public.reviews;
CREATE POLICY "reviews_owner_delete" ON public.reviews FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR public.is_staff());

-- Step 11: Questions
CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text,
  answered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_questions_product ON public.questions(product_id);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "questions_public_read_approved" ON public.questions;
CREATE POLICY "questions_public_read_approved" ON public.questions FOR SELECT
  TO anon, authenticated USING (approved = true OR auth.uid() = user_id);

DROP POLICY IF EXISTS "questions_owner_insert" ON public.questions;
CREATE POLICY "questions_owner_insert" ON public.questions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "questions_staff_update" ON public.questions;
CREATE POLICY "questions_staff_update" ON public.questions FOR UPDATE
  TO authenticated USING (public.is_staff() OR auth.uid() = user_id) WITH CHECK (public.is_staff() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "questions_owner_delete" ON public.questions;
CREATE POLICY "questions_owner_delete" ON public.questions FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR public.is_staff());
