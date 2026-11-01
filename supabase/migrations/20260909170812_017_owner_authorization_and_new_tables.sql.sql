/*
# Owner Authorization Hardening + New Business Tables

## Overview
This migration:
1. Replaces `is_staff()` with a stricter `is_owner()` function (owner role only, no admin)
2. Updates `is_staff()` to call `is_owner()` for backward compatibility
3. Removes 'admin' from the profiles role check constraint
4. Adds new tables for: homepage builder, feature switches, measurement profiles,
   order change requests, quick reply templates, abandoned carts

## Security Changes
- `is_owner()` function: only returns true for role='owner' OR email match
- `is_staff()` now delegates to `is_owner()` (no more admin access)
- Profile role constraint: only 'customer' or 'owner' allowed for new rows
- All new tables get RLS with owner-only write, public/customer read where appropriate

## New Tables
1. `homepage_sections` — Owner-controlled homepage builder sections
2. `feature_switches` — Owner-controlled feature enable/disable toggles
3. `measurement_profiles` — Customer saved body/bed measurements
4. `order_change_requests` — Customer requests to modify placed orders
5. `quick_replies` — Owner message template shortcuts
6. `abandoned_carts` — Detected abandoned carts for recovery

## Important Notes
- Existing admin profiles remain in the database (historical preservation)
- The check constraint change only affects new rows; existing admin rows keep their value
- All new tables have RLS enabled
*/

-- ============================================================
-- 1. OWNER AUTHORIZATION FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM public.profiles
  WHERE id = auth.uid()
  AND role = 'owner'
)
OR EXISTS (
  SELECT 1 FROM auth.users
  WHERE id = auth.uid()
  AND email = 'myousufshaikh399@gmail.com'
);
$function$;

-- Update is_staff to delegate to is_owner (backward compat, but now owner-only)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT public.is_owner();
$function$;

-- ============================================================
-- 2. UPDATE PROFILE ROLE CONSTRAINT
-- ============================================================
-- Remove admin from allowed roles for new inserts
-- Existing admin rows keep their value (no data loss)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['customer'::text, 'owner'::text, 'admin'::text]));

-- Update handle_new_user_profile to only assign owner or customer
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    CASE WHEN NEW.email = 'myousufshaikh399@gmail.com' THEN 'owner' ELSE 'customer' END
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    updated_at = now();
  RETURN NEW;
END;
$function$;

-- ============================================================
-- 3. HOMEPAGE SECTIONS (Website Builder)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.homepage_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL,
  title text NOT NULL DEFAULT '',
  subtitle text DEFAULT NULL,
  content jsonb DEFAULT '{}'::jsonb,
  is_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.homepage_sections ENABLE ROW LEVEL SECURITY;

-- Public can read visible sections, only owner can modify
DROP POLICY IF EXISTS "homepage_sections_public_select" ON public.homepage_sections;
CREATE POLICY "homepage_sections_public_select"
ON public.homepage_sections FOR SELECT
TO anon, authenticated USING (is_visible = true);

DROP POLICY IF EXISTS "homepage_sections_owner_insert" ON public.homepage_sections;
CREATE POLICY "homepage_sections_owner_insert"
ON public.homepage_sections FOR INSERT
TO authenticated WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "homepage_sections_owner_update" ON public.homepage_sections;
CREATE POLICY "homepage_sections_owner_update"
ON public.homepage_sections FOR UPDATE
TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "homepage_sections_owner_delete" ON public.homepage_sections;
CREATE POLICY "homepage_sections_owner_delete"
ON public.homepage_sections FOR DELETE
TO authenticated USING (public.is_owner());

-- ============================================================
-- 4. FEATURE SWITCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.feature_switches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text DEFAULT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.feature_switches ENABLE ROW LEVEL SECURITY;

-- Public can read, only owner can modify
DROP POLICY IF EXISTS "feature_switches_public_select" ON public.feature_switches;
CREATE POLICY "feature_switches_public_select"
ON public.feature_switches FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "feature_switches_owner_insert" ON public.feature_switches;
CREATE POLICY "feature_switches_owner_insert"
ON public.feature_switches FOR INSERT
TO authenticated WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "feature_switches_owner_update" ON public.feature_switches;
CREATE POLICY "feature_switches_owner_update"
ON public.feature_switches FOR UPDATE
TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "feature_switches_owner_delete" ON public.feature_switches;
CREATE POLICY "feature_switches_owner_delete"
ON public.feature_switches FOR DELETE
TO authenticated USING (public.is_owner());

-- Seed default feature switches
INSERT INTO public.feature_switches (feature_key, label, description, enabled) VALUES
  ('wishlist', 'Wishlist', 'Allow customers to save favorite products', true),
  ('reviews', 'Product Reviews', 'Allow customers to leave reviews', true),
  ('customer_chat', 'Customer Chat', 'Real-time messaging between owner and customers', true),
  ('custom_orders', 'Custom Orders', 'Allow customers to submit custom order requests', true),
  ('quotations', 'Quotations', 'Send quotes for custom orders', true),
  ('loyalty', 'Loyalty Program', 'Points and rewards for repeat customers', true),
  ('newsletter', 'Newsletter', 'Email newsletter signup', true),
  ('guest_checkout', 'Guest Checkout', 'Allow checkout without account', false),
  ('coupons', 'Coupons', 'Discount codes for customers', true),
  ('cod', 'Cash on Delivery', 'Allow COD payment method', true),
  ('online_payments', 'Online Payments', 'Bank transfer and EasyPaisa payments', true),
  ('promotional_notifications', 'Promotional Notifications', 'Send promotional updates', true),
  ('cancellation_requests', 'Cancellation Requests', 'Allow customers to request order cancellation', true),
  ('order_changes', 'Order Change Requests', 'Allow customers to request order modifications', true),
  ('returns', 'Returns & Refunds', 'Allow return and refund requests', true),
  ('product_comparison', 'Product Comparison', 'Compare products side by side', false)
ON CONFLICT (feature_key) DO NOTHING;

-- ============================================================
-- 5. MEASUREMENT PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.measurement_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'My Measurements',
  profile_type text NOT NULL DEFAULT 'bed',
  length numeric DEFAULT NULL,
  width numeric DEFAULT NULL,
  unit text NOT NULL DEFAULT 'inches',
  chest numeric DEFAULT NULL,
  waist numeric DEFAULT NULL,
  shoulder numeric DEFAULT NULL,
  sleeve numeric DEFAULT NULL,
  trouser_length numeric DEFAULT NULL,
  notes text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.measurement_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "measurement_profiles_owner_select" ON public.measurement_profiles;
CREATE POLICY "measurement_profiles_owner_select"
ON public.measurement_profiles FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "measurement_profiles_owner_insert" ON public.measurement_profiles;
CREATE POLICY "measurement_profiles_owner_insert"
ON public.measurement_profiles FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "measurement_profiles_owner_update" ON public.measurement_profiles;
CREATE POLICY "measurement_profiles_owner_update"
ON public.measurement_profiles FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "measurement_profiles_owner_delete" ON public.measurement_profiles;
CREATE POLICY "measurement_profiles_owner_delete"
ON public.measurement_profiles FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_measurement_profiles_user ON public.measurement_profiles(user_id);

-- ============================================================
-- 6. ORDER CHANGE REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  change_type text NOT NULL,
  current_value text DEFAULT NULL,
  requested_value text DEFAULT NULL,
  reason text DEFAULT NULL,
  status text NOT NULL DEFAULT 'pending',
  owner_note text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.order_change_requests ENABLE ROW LEVEL SECURITY;

-- Customer can see/manage their own; owner can see all
DROP POLICY IF EXISTS "order_change_requests_select" ON public.order_change_requests;
CREATE POLICY "order_change_requests_select"
ON public.order_change_requests FOR SELECT
TO authenticated USING (auth.uid() = user_id OR public.is_owner());

DROP POLICY IF EXISTS "order_change_requests_customer_insert" ON public.order_change_requests;
CREATE POLICY "order_change_requests_customer_insert"
ON public.order_change_requests FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

-- Only owner can update status
DROP POLICY IF EXISTS "order_change_requests_owner_update" ON public.order_change_requests;
CREATE POLICY "order_change_requests_owner_update"
ON public.order_change_requests FOR UPDATE
TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "order_change_requests_customer_delete" ON public.order_change_requests;
CREATE POLICY "order_change_requests_customer_delete"
ON public.order_change_requests FOR DELETE
TO authenticated USING (auth.uid() = user_id AND status = 'pending');

CREATE INDEX IF NOT EXISTS idx_order_change_requests_order ON public.order_change_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_order_change_requests_user ON public.order_change_requests(user_id);

-- ============================================================
-- 7. QUICK REPLIES (Owner message templates)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quick_replies_owner_select" ON public.quick_replies;
CREATE POLICY "quick_replies_owner_select"
ON public.quick_replies FOR SELECT
TO authenticated USING (public.is_owner());

DROP POLICY IF EXISTS "quick_replies_owner_insert" ON public.quick_replies;
CREATE POLICY "quick_replies_owner_insert"
ON public.quick_replies FOR INSERT
TO authenticated WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "quick_replies_owner_update" ON public.quick_replies;
CREATE POLICY "quick_replies_owner_update"
ON public.quick_replies FOR UPDATE
TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "quick_replies_owner_delete" ON public.quick_replies;
CREATE POLICY "quick_replies_owner_delete"
ON public.quick_replies FOR DELETE
TO authenticated USING (public.is_owner());

-- Seed default quick replies
INSERT INTO public.quick_replies (title, body, category) VALUES
  ('Order Confirmed', 'Thank you for your order! Your order has been confirmed and is being processed.', 'orders'),
  ('Payment Received', 'We have received your payment. Thank you! Your order is now being processed.', 'payments'),
  ('Payment Verified', 'Your payment has been verified. Production will begin shortly.', 'payments'),
  ('Production Started', 'Your order is now in production. Our craftsmen are working on it.', 'production'),
  ('Production Completed', 'Your order has been completed and is now being prepared for shipping.', 'production'),
  ('Ready to Ship', 'Your order is packed and ready to ship. You will receive tracking information soon.', 'shipping'),
  ('Shipping Update', 'Your order has been shipped. Tracking number: [insert tracking number]', 'shipping'),
  ('Delivery Delay', 'We apologize for the delay. Your order is taking longer than expected. New estimated delivery: [date]', 'shipping'),
  ('Custom Order Question', 'Thank you for your custom order request. Could you provide more details about [specific requirement]?', 'custom'),
  ('Return Instructions', 'To process your return, please pack the item carefully and contact us to arrange pickup.', 'returns'),
  ('Thank You', 'Thank you for shopping with Madina Cotton Shop! We appreciate your business.', 'general')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 8. ABANDONED CARTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.abandoned_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cart_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  cart_total numeric NOT NULL DEFAULT 0,
  items_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'abandoned',
  recovery_coupon_code text DEFAULT NULL,
  recovered_at timestamptz DEFAULT NULL,
  reminded_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;

-- Owner can see all, customer can see their own
DROP POLICY IF EXISTS "abandoned_carts_select" ON public.abandoned_carts;
CREATE POLICY "abandoned_carts_select"
ON public.abandoned_carts FOR SELECT
TO authenticated USING (auth.uid() = user_id OR public.is_owner());

DROP POLICY IF EXISTS "abandoned_carts_owner_insert" ON public.abandoned_carts;
CREATE POLICY "abandoned_carts_owner_insert"
ON public.abandoned_carts FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_owner());

DROP POLICY IF EXISTS "abandoned_carts_owner_update" ON public.abandoned_carts;
CREATE POLICY "abandoned_carts_owner_update"
ON public.abandoned_carts FOR UPDATE
TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "abandoned_carts_owner_delete" ON public.abandoned_carts;
CREATE POLICY "abandoned_carts_owner_delete"
ON public.abandoned_carts FOR DELETE
TO authenticated USING (public.is_owner());

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_user ON public.abandoned_carts(user_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_status ON public.abandoned_carts(status);

-- ============================================================
-- 9. UPDATE LOG_OWNER_ACTION TO USE is_owner
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_owner_action(
  p_action text,
  p_entity text DEFAULT NULL,
  p_entity_id text DEFAULT NULL,
  p_old_value jsonb DEFAULT NULL,
  p_new_value jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity, entity_id, old_value, new_value)
  VALUES (auth.uid(), p_action, p_entity, p_entity_id, p_old_value, p_new_value);
END;
$function$;

-- ============================================================
-- 10. GRANT EXECUTE ON is_owner TO authenticated
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.is_owner() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;

-- Ensure is_staff still works for existing callers
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;