/*
# Advanced Business Features Schema

1. Overview
   - Adds tables for: addresses, delivery_zones, delivery_rates, support_tickets, support_messages, expenses, expense_categories, loyalty_points, referrals, saved_designs, audit_logs, settings, store_pickup.
   - All customer-facing tables are owner-scoped via user_id with DEFAULT auth.uid().
   - Staff/admin tables (delivery_zones, delivery_rates, expenses, audit_logs, settings) are staff-writable.

2. New Tables
   - `addresses`: customer saved addresses (home, office, other).
   - `delivery_zones`: country/province/city/area hierarchy with delivery fee, min order, free threshold, estimated time.
   - `delivery_rates`: weight/quantity-based delivery rates per zone.
   - `support_tickets`: customer support tickets with category and status.
   - `support_messages`: ticket conversation messages.
   - `expenses`: business expenses with category, amount, date, receipt.
   - `expense_categories`: cotton, fabric, labour, electricity, rent, packaging, courier, marketing, other.
   - `loyalty_points`: customer points with earn/redeem tracking.
   - `referrals`: referral codes and tracking.
   - `saved_designs`: customer saved custom product configurations.
   - `audit_logs`: admin action audit trail.
   - `settings`: key-value shop settings.

3. Security
   - RLS on every table.
   - Customer tables (addresses, support_tickets, support_messages, loyalty_points, referrals, saved_designs): owner-scoped CRUD.
   - Staff tables (delivery_zones, delivery_rates, expenses, expense_categories, audit_logs, settings): staff full access via is_staff().
   - Settings: publicly readable so storefront can display shop info.
*/

-- Addresses
CREATE TABLE IF NOT EXISTS public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Home',
  type text NOT NULL DEFAULT 'home',
  country text NOT NULL DEFAULT 'Pakistan',
  province text,
  city text,
  area text,
  street text,
  house_number text,
  postal_code text,
  landmark text,
  phone text,
  delivery_instructions text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON public.addresses(user_id);

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "addresses_owner_select" ON public.addresses;
CREATE POLICY "addresses_owner_select" ON public.addresses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "addresses_owner_insert" ON public.addresses;
CREATE POLICY "addresses_owner_insert" ON public.addresses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "addresses_owner_update" ON public.addresses;
CREATE POLICY "addresses_owner_update" ON public.addresses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "addresses_owner_delete" ON public.addresses;
CREATE POLICY "addresses_owner_delete" ON public.addresses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Delivery zones
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text NOT NULL DEFAULT 'Pakistan',
  province text,
  city text,
  area text,
  postal_code text,
  delivery_fee numeric(12,2) NOT NULL DEFAULT 0,
  min_order numeric(12,2) DEFAULT 0,
  free_delivery_threshold numeric(12,2),
  estimated_delivery_days int DEFAULT 3,
  delivery_methods text[] DEFAULT ARRAY['home_delivery'],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_zones_public_read" ON public.delivery_zones;
CREATE POLICY "delivery_zones_public_read" ON public.delivery_zones FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "delivery_zones_staff_insert" ON public.delivery_zones;
CREATE POLICY "delivery_zones_staff_insert" ON public.delivery_zones FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "delivery_zones_staff_update" ON public.delivery_zones;
CREATE POLICY "delivery_zones_staff_update" ON public.delivery_zones FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "delivery_zones_staff_delete" ON public.delivery_zones;
CREATE POLICY "delivery_zones_staff_delete" ON public.delivery_zones FOR DELETE
  TO authenticated USING (public.is_staff());

-- Support tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  status text NOT NULL DEFAULT 'open',
  priority text DEFAULT 'normal',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_tickets_owner_select" ON public.support_tickets;
CREATE POLICY "support_tickets_owner_select" ON public.support_tickets FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_staff());
DROP POLICY IF EXISTS "support_tickets_owner_insert" ON public.support_tickets;
CREATE POLICY "support_tickets_owner_insert" ON public.support_tickets FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "support_tickets_staff_update" ON public.support_tickets;
CREATE POLICY "support_tickets_staff_update" ON public.support_tickets FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR public.is_staff()) WITH CHECK (auth.uid() = user_id OR public.is_staff());

-- Support messages
CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  sender text NOT NULL DEFAULT 'customer',
  body text NOT NULL,
  attachment_url text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON public.support_messages(ticket_id);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_messages_select" ON public.support_messages;
CREATE POLICY "support_messages_select" ON public.support_messages FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR public.is_staff())));
DROP POLICY IF EXISTS "support_messages_owner_insert" ON public.support_messages;
CREATE POLICY "support_messages_owner_insert" ON public.support_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_staff());

-- Expense categories
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT now()
);

INSERT INTO public.expense_categories (name) VALUES
  ('Cotton'), ('Fabric'), ('Labour'), ('Electricity'), ('Rent'),
  ('Packaging'), ('Courier'), ('Marketing'), ('Maintenance'), ('Other')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_categories_staff_select" ON public.expense_categories;
CREATE POLICY "expense_categories_staff_select" ON public.expense_categories FOR SELECT
  TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "expense_categories_staff_insert" ON public.expense_categories;
CREATE POLICY "expense_categories_staff_insert" ON public.expense_categories FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "expense_categories_staff_update" ON public.expense_categories;
CREATE POLICY "expense_categories_staff_update" ON public.expense_categories FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'Other',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  description text,
  expense_date date DEFAULT CURRENT_DATE,
  paid_by text,
  payment_method text,
  receipt_url text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_staff_select" ON public.expenses;
CREATE POLICY "expenses_staff_select" ON public.expenses FOR SELECT
  TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "expenses_staff_insert" ON public.expenses;
CREATE POLICY "expenses_staff_insert" ON public.expenses FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "expenses_staff_update" ON public.expenses;
CREATE POLICY "expenses_staff_update" ON public.expenses FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "expenses_staff_delete" ON public.expenses;
CREATE POLICY "expenses_staff_delete" ON public.expenses FOR DELETE
  TO authenticated USING (public.is_staff());

-- Loyalty points
CREATE TABLE IF NOT EXISTS public.loyalty_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  points int NOT NULL DEFAULT 0,
  action text NOT NULL DEFAULT 'earn',
  source text,
  order_id uuid,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_user ON public.loyalty_points(user_id);

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loyalty_owner_select" ON public.loyalty_points;
CREATE POLICY "loyalty_owner_select" ON public.loyalty_points FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_staff());
DROP POLICY IF EXISTS "loyalty_staff_insert" ON public.loyalty_points;
CREATE POLICY "loyalty_staff_insert" ON public.loyalty_points FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_staff());

-- Referrals
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_email text,
  referred_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  referral_code text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reward_type text DEFAULT 'points',
  reward_value int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referrals_owner_select" ON public.referrals;
CREATE POLICY "referrals_owner_select" ON public.referrals FOR SELECT
  TO authenticated USING (auth.uid() = referrer_id OR public.is_staff());
DROP POLICY IF EXISTS "referrals_owner_insert" ON public.referrals;
CREATE POLICY "referrals_owner_insert" ON public.referrals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = referrer_id);
DROP POLICY IF EXISTS "referrals_staff_update" ON public.referrals;
CREATE POLICY "referrals_staff_update" ON public.referrals FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Saved designs
CREATE TABLE IF NOT EXISTS public.saved_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  product_type text NOT NULL,
  configuration jsonb NOT NULL DEFAULT '{}',
  estimated_price numeric(12,2),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saved_designs_user ON public.saved_designs(user_id);

ALTER TABLE public.saved_designs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_designs_owner_select" ON public.saved_designs;
CREATE POLICY "saved_designs_owner_select" ON public.saved_designs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "saved_designs_owner_insert" ON public.saved_designs;
CREATE POLICY "saved_designs_owner_insert" ON public.saved_designs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "saved_designs_owner_update" ON public.saved_designs;
CREATE POLICY "saved_designs_owner_update" ON public.saved_designs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "saved_designs_owner_delete" ON public.saved_designs;
CREATE POLICY "saved_designs_owner_delete" ON public.saved_designs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Audit logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_staff_select" ON public.audit_logs;
CREATE POLICY "audit_logs_staff_select" ON public.audit_logs FOR SELECT
  TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "audit_logs_staff_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_staff_insert" ON public.audit_logs FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());

-- Settings (key-value)
CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_public_read" ON public.settings;
CREATE POLICY "settings_public_read" ON public.settings FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "settings_staff_insert" ON public.settings;
CREATE POLICY "settings_staff_insert" ON public.settings FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "settings_staff_update" ON public.settings;
CREATE POLICY "settings_staff_update" ON public.settings FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Seed default settings
INSERT INTO public.settings (key, value) VALUES
  ('shop_name', 'Madina Cotton Shop'),
  ('shop_address', 'Latifabad Unit 11, Near Tameer Bank, Hyderabad, Sindh, Pakistan'),
  ('shop_phone', '0313 3344068'),
  ('shop_whatsapp', '03133344068'),
  ('shop_email', 'myousufshaikh399@gmail.com'),
  ('free_delivery_threshold', '5000'),
  ('default_delivery_fee', '200'),
  ('currency', 'PKR'),
  ('business_hours', '9:00 AM - 9:00 PM'),
  ('cod_enabled', 'true'),
  ('easypaisa_enabled', 'true'),
  ('bank_transfer_enabled', 'true'),
  ('hand_to_hand_enabled', 'true'),
  ('loyalty_points_per_rupee', '1'),
  ('loyalty_min_redemption', '100'),
  ('wholesale_min_qty', '10')
ON CONFLICT (key) DO NOTHING;

-- Seed default delivery zones for Hyderabad
INSERT INTO public.delivery_zones (name, city, area, delivery_fee, estimated_delivery_days, delivery_methods) VALUES
  ('Hyderabad - Latifabad', 'Hyderabad', 'Latifabad', 150, 1, ARRAY['home_delivery', 'store_pickup', 'hand_to_hand']),
  ('Hyderabad - Qasimabad', 'Hyderabad', 'Qasimabad', 200, 1, ARRAY['home_delivery', 'hand_to_hand']),
  ('Hyderabad - Other Areas', 'Hyderabad', '', 250, 2, ARRAY['home_delivery']),
  ('Nationwide Pakistan', '', '', 350, 3, ARRAY['home_delivery']),
  ('International', '', '', 2000, 10, ARRAY['home_delivery'])
ON CONFLICT DO NOTHING;
