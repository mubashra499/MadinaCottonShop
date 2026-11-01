/*
# Commerce, Orders, Custom Orders & Business Management

1. Overview
   - Commerce and business-management tables: carts, cart_items, orders, order_items, payments, wishlists, custom orders, custom order images, custom quotes, messages, suppliers, materials, purchases, inventory movements, production orders, QC checks, coupons, notifications, wholesale accounts, returns.
   - Customer-facing data is owner-scoped via user_id with DEFAULT auth.uid().
   - Catalog/config tables (materials, suppliers, coupons) are staff-writable.

2. New Tables
   - `carts` / `cart_items`: per-user shopping cart.
   - `orders`: order_number, status, totals, addresses, payment_method, notes, internal_notes, tracking.
   - `order_items`: snapshot of purchased variant details, qty, unit_price, customization, reference_images.
   - `payments`: method, amount, status, provider, provider_ref, paid_at.
   - `wishlists`: user + product (+ optional variant).
   - `custom_orders`: custom product request with all customization fields + instructions + status.
   - `custom_order_images`: reference images with notes and image_type.
   - `custom_quotes`: price, production_time, delivery_charge, discount, expiry, status, notes.
   - `messages`: customer-to-shop chat, product/order context, sender, read flag.
   - `suppliers`: name, contact, material, notes.
   - `materials`: name, unit, stock, cost, supplier_id, min_stock, reorder_level.
   - `purchases`: supplier/material, qty, unit, cost, invoice, payment_status, date.
   - `inventory_movements`: product/variant, movement_type, quantity, note.
   - `production_orders`: order/custom link, status, deadline, assigned_to, notes.
   - `quality_checks`: production link, checklist jsonb, result, checked_by.
   - `coupons`: code, discount_type, value, dates, limits, active.
   - `notifications`: user, type, title, body, read.
   - `wholesale_accounts`: user, business_name, contact, verified, status.
   - `returns`: order, user, reason, status.

3. Security
   - RLS on every table.
   - Cart/wishlist/orders/order_items/payments/messages/notifications/returns: owner-scoped CRUD (user_id = auth.uid()).
   - Custom orders + images + quotes: customer creates/reads own; staff can read/update all.
   - Suppliers/materials/purchases/inventory/production/QC/wholesale: staff full access.
   - Coupons: publicly readable (active only) so storefront can validate codes.
*/

-- Carts
CREATE TABLE IF NOT EXISTS public.carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_carts_user ON public.carts(user_id);

ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carts_owner_select" ON public.carts;
CREATE POLICY "carts_owner_select" ON public.carts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "carts_owner_insert" ON public.carts;
CREATE POLICY "carts_owner_insert" ON public.carts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "carts_owner_update" ON public.carts;
CREATE POLICY "carts_owner_update" ON public.carts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "carts_owner_delete" ON public.carts;
CREATE POLICY "carts_owner_delete" ON public.carts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Cart items
CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  customization jsonb,
  note text,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON public.cart_items(cart_id);

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cart_items_owner_select" ON public.cart_items;
CREATE POLICY "cart_items_owner_select" ON public.cart_items FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS "cart_items_owner_insert" ON public.cart_items;
CREATE POLICY "cart_items_owner_insert" ON public.cart_items FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS "cart_items_owner_update" ON public.cart_items;
CREATE POLICY "cart_items_owner_update" ON public.cart_items FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS "cart_items_owner_delete" ON public.cart_items;
CREATE POLICY "cart_items_owner_delete" ON public.cart_items FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_id AND c.user_id = auth.uid()));

-- Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'new',
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  shipping_fee numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'PKR',
  payment_method text NOT NULL DEFAULT 'cod',
  payment_status text NOT NULL DEFAULT 'pending',
  customer_name text,
  customer_phone text,
  customer_email text,
  country text,
  city text,
  address text,
  postal_code text,
  landmark text,
  delivery_instructions text,
  notes text,
  internal_notes text,
  tracking_number text,
  courier text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_number ON public.orders(order_number);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_owner_select" ON public.orders;
CREATE POLICY "orders_owner_select" ON public.orders FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_staff());
DROP POLICY IF EXISTS "orders_owner_insert" ON public.orders;
CREATE POLICY "orders_owner_insert" ON public.orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "orders_staff_update" ON public.orders;
CREATE POLICY "orders_staff_update" ON public.orders FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR public.is_staff()) WITH CHECK (auth.uid() = user_id OR public.is_staff());
DROP POLICY IF EXISTS "orders_owner_delete" ON public.orders;
CREATE POLICY "orders_owner_delete" ON public.orders FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Order items
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  size_label text,
  weight text,
  filling text,
  fabric text,
  color text,
  design text,
  stitching text,
  decoration text,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  customization jsonb,
  reference_images jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_items_owner_select" ON public.order_items;
CREATE POLICY "order_items_owner_select" ON public.order_items FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.is_staff())));
DROP POLICY IF EXISTS "order_items_owner_insert" ON public.order_items;
CREATE POLICY "order_items_owner_insert" ON public.order_items FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
DROP POLICY IF EXISTS "order_items_staff_update" ON public.order_items;
CREATE POLICY "order_items_staff_update" ON public.order_items FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.is_staff()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.is_staff()));
DROP POLICY IF EXISTS "order_items_owner_delete" ON public.order_items;
CREATE POLICY "order_items_owner_delete" ON public.order_items FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));

-- Payments
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  method text NOT NULL DEFAULT 'cod',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  provider text,
  provider_ref text,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_owner_select" ON public.payments;
CREATE POLICY "payments_owner_select" ON public.payments FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.is_staff())));
DROP POLICY IF EXISTS "payments_owner_insert" ON public.payments;
CREATE POLICY "payments_owner_insert" ON public.payments FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
DROP POLICY IF EXISTS "payments_staff_update" ON public.payments;
CREATE POLICY "payments_staff_update" ON public.payments FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.is_staff()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.is_staff()));

-- Wishlists
CREATE TABLE IF NOT EXISTS public.wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wishlist_user_product ON public.wishlists(user_id, product_id);

ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wishlist_owner_select" ON public.wishlists;
CREATE POLICY "wishlist_owner_select" ON public.wishlists FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "wishlist_owner_insert" ON public.wishlists;
CREATE POLICY "wishlist_owner_insert" ON public.wishlists FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "wishlist_owner_delete" ON public.wishlists;
CREATE POLICY "wishlist_owner_delete" ON public.wishlists FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Custom orders
CREATE TABLE IF NOT EXISTS public.custom_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_type text NOT NULL,
  size_label text,
  width numeric(8,2),
  length numeric(8,2),
  unit text DEFAULT 'inches',
  weight text,
  filling text,
  fabric text,
  color text,
  color_hex text,
  front_design text,
  back_design text,
  stitching text,
  decoration text,
  quantity int NOT NULL DEFAULT 1,
  instructions text,
  status text NOT NULL DEFAULT 'requested',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_custom_orders_user ON public.custom_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_orders_status ON public.custom_orders(status);

ALTER TABLE public.custom_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "custom_orders_owner_select" ON public.custom_orders;
CREATE POLICY "custom_orders_owner_select" ON public.custom_orders FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_staff());
DROP POLICY IF EXISTS "custom_orders_owner_insert" ON public.custom_orders;
CREATE POLICY "custom_orders_owner_insert" ON public.custom_orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "custom_orders_staff_update" ON public.custom_orders;
CREATE POLICY "custom_orders_staff_update" ON public.custom_orders FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR public.is_staff()) WITH CHECK (auth.uid() = user_id OR public.is_staff());
DROP POLICY IF EXISTS "custom_orders_owner_delete" ON public.custom_orders;
CREATE POLICY "custom_orders_owner_delete" ON public.custom_orders FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Custom order images
CREATE TABLE IF NOT EXISTS public.custom_order_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_order_id uuid NOT NULL REFERENCES public.custom_orders(id) ON DELETE CASCADE,
  url text NOT NULL,
  note text,
  image_type text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_custom_order_images_order ON public.custom_order_images(custom_order_id);

ALTER TABLE public.custom_order_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "custom_order_images_owner_select" ON public.custom_order_images;
CREATE POLICY "custom_order_images_owner_select" ON public.custom_order_images FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM public.custom_orders c WHERE c.id = custom_order_id AND (c.user_id = auth.uid() OR public.is_staff())));
DROP POLICY IF EXISTS "custom_order_images_owner_insert" ON public.custom_order_images;
CREATE POLICY "custom_order_images_owner_insert" ON public.custom_order_images FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.custom_orders c WHERE c.id = custom_order_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS "custom_order_images_owner_delete" ON public.custom_order_images;
CREATE POLICY "custom_order_images_owner_delete" ON public.custom_order_images FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM public.custom_orders c WHERE c.id = custom_order_id AND c.user_id = auth.uid()));

-- Custom quotes
CREATE TABLE IF NOT EXISTS public.custom_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_order_id uuid NOT NULL REFERENCES public.custom_orders(id) ON DELETE CASCADE,
  price numeric(12,2) NOT NULL DEFAULT 0,
  production_time text,
  delivery_charge numeric(12,2) DEFAULT 0,
  discount numeric(12,2) DEFAULT 0,
  expiry timestamptz,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_custom_quotes_order ON public.custom_quotes(custom_order_id);

ALTER TABLE public.custom_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "custom_quotes_select" ON public.custom_quotes;
CREATE POLICY "custom_quotes_select" ON public.custom_quotes FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM public.custom_orders c WHERE c.id = custom_order_id AND (c.user_id = auth.uid() OR public.is_staff())));
DROP POLICY IF EXISTS "custom_quotes_staff_insert" ON public.custom_quotes;
CREATE POLICY "custom_quotes_staff_insert" ON public.custom_quotes FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "custom_quotes_staff_update" ON public.custom_quotes;
CREATE POLICY "custom_quotes_staff_update" ON public.custom_quotes FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Messages (customer-to-shop chat)
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  sender text NOT NULL DEFAULT 'customer',
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_user ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_read ON public.messages(read);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_owner_select" ON public.messages;
CREATE POLICY "messages_owner_select" ON public.messages FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR (public.is_staff() AND sender = 'customer'));
DROP POLICY IF EXISTS "messages_owner_insert" ON public.messages;
CREATE POLICY "messages_owner_insert" ON public.messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_staff());
DROP POLICY IF EXISTS "messages_staff_update" ON public.messages;
CREATE POLICY "messages_staff_update" ON public.messages FOR UPDATE
  TO authenticated USING (public.is_staff() OR auth.uid() = user_id) WITH CHECK (public.is_staff() OR auth.uid() = user_id);

-- Suppliers (before materials)
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact text,
  material text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_staff_select" ON public.suppliers;
CREATE POLICY "suppliers_staff_select" ON public.suppliers FOR SELECT
  TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "suppliers_staff_insert" ON public.suppliers;
CREATE POLICY "suppliers_staff_insert" ON public.suppliers FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "suppliers_staff_update" ON public.suppliers;
CREATE POLICY "suppliers_staff_update" ON public.suppliers FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "suppliers_staff_delete" ON public.suppliers;
CREATE POLICY "suppliers_staff_delete" ON public.suppliers FOR DELETE
  TO authenticated USING (public.is_staff());

-- Materials
CREATE TABLE IF NOT EXISTS public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  stock numeric(12,2) NOT NULL DEFAULT 0,
  cost numeric(12,2) NOT NULL DEFAULT 0,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  min_stock numeric(12,2) NOT NULL DEFAULT 0,
  reorder_level numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "materials_staff_select" ON public.materials;
CREATE POLICY "materials_staff_select" ON public.materials FOR SELECT
  TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "materials_staff_insert" ON public.materials;
CREATE POLICY "materials_staff_insert" ON public.materials FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "materials_staff_update" ON public.materials;
CREATE POLICY "materials_staff_update" ON public.materials FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "materials_staff_delete" ON public.materials;
CREATE POLICY "materials_staff_delete" ON public.materials FOR DELETE
  TO authenticated USING (public.is_staff());

-- Purchases
CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'kg',
  cost numeric(12,2) NOT NULL DEFAULT 0,
  invoice text,
  payment_status text NOT NULL DEFAULT 'pending',
  purchase_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchases_staff_select" ON public.purchases;
CREATE POLICY "purchases_staff_select" ON public.purchases FOR SELECT
  TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "purchases_staff_insert" ON public.purchases;
CREATE POLICY "purchases_staff_insert" ON public.purchases FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "purchases_staff_update" ON public.purchases;
CREATE POLICY "purchases_staff_update" ON public.purchases FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "purchases_staff_delete" ON public.purchases;
CREATE POLICY "purchases_staff_delete" ON public.purchases FOR DELETE
  TO authenticated USING (public.is_staff());

-- Inventory movements
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  movement_type text NOT NULL DEFAULT 'adjustment',
  quantity int NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON public.inventory_movements(product_id);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_staff_select" ON public.inventory_movements;
CREATE POLICY "inventory_staff_select" ON public.inventory_movements FOR SELECT
  TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "inventory_staff_insert" ON public.inventory_movements;
CREATE POLICY "inventory_staff_insert" ON public.inventory_movements FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());

-- Production orders
CREATE TABLE IF NOT EXISTS public.production_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  custom_order_id uuid REFERENCES public.custom_orders(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'new',
  deadline date,
  assigned_to text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_production_status ON public.production_orders(status);

ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "production_staff_select" ON public.production_orders;
CREATE POLICY "production_staff_select" ON public.production_orders FOR SELECT
  TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "production_staff_insert" ON public.production_orders;
CREATE POLICY "production_staff_insert" ON public.production_orders FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "production_staff_update" ON public.production_orders;
CREATE POLICY "production_staff_update" ON public.production_orders FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "production_staff_delete" ON public.production_orders;
CREATE POLICY "production_staff_delete" ON public.production_orders FOR DELETE
  TO authenticated USING (public.is_staff());

-- Quality checks
CREATE TABLE IF NOT EXISTS public.quality_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  checklist jsonb NOT NULL DEFAULT '{}',
  result text NOT NULL DEFAULT 'pending',
  checked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qc_production ON public.quality_checks(production_order_id);

ALTER TABLE public.quality_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qc_staff_select" ON public.quality_checks;
CREATE POLICY "qc_staff_select" ON public.quality_checks FOR SELECT
  TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "qc_staff_insert" ON public.quality_checks;
CREATE POLICY "qc_staff_insert" ON public.quality_checks FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "qc_staff_update" ON public.quality_checks;
CREATE POLICY "qc_staff_update" ON public.quality_checks FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Coupons
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  discount_type text NOT NULL DEFAULT 'percentage',
  value numeric(12,2) NOT NULL DEFAULT 0,
  start_date timestamptz,
  end_date timestamptz,
  usage_limit int,
  per_customer_limit int DEFAULT 1,
  min_order numeric(12,2) DEFAULT 0,
  max_discount numeric(12,2),
  usage_count int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coupons_public_select" ON public.coupons;
CREATE POLICY "coupons_public_select" ON public.coupons FOR SELECT
  TO anon, authenticated USING (active = true);
DROP POLICY IF EXISTS "coupons_staff_insert" ON public.coupons;
CREATE POLICY "coupons_staff_insert" ON public.coupons FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "coupons_staff_update" ON public.coupons;
CREATE POLICY "coupons_staff_update" ON public.coupons FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "coupons_staff_delete" ON public.coupons;
CREATE POLICY "coupons_staff_delete" ON public.coupons FOR DELETE
  TO authenticated USING (public.is_staff());

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_owner_select" ON public.notifications;
CREATE POLICY "notifications_owner_select" ON public.notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notifications_owner_insert" ON public.notifications;
CREATE POLICY "notifications_owner_insert" ON public.notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_staff());
DROP POLICY IF EXISTS "notifications_owner_update" ON public.notifications;
CREATE POLICY "notifications_owner_update" ON public.notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "notifications_owner_delete" ON public.notifications;
CREATE POLICY "notifications_owner_delete" ON public.notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Wholesale accounts
CREATE TABLE IF NOT EXISTS public.wholesale_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  contact text,
  verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wholesale_user ON public.wholesale_accounts(user_id);

ALTER TABLE public.wholesale_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wholesale_owner_select" ON public.wholesale_accounts;
CREATE POLICY "wholesale_owner_select" ON public.wholesale_accounts FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_staff());
DROP POLICY IF EXISTS "wholesale_owner_insert" ON public.wholesale_accounts;
CREATE POLICY "wholesale_owner_insert" ON public.wholesale_accounts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "wholesale_staff_update" ON public.wholesale_accounts;
CREATE POLICY "wholesale_staff_update" ON public.wholesale_accounts FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Returns
CREATE TABLE IF NOT EXISTS public.returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  status text NOT NULL DEFAULT 'requested',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_returns_user ON public.returns(user_id);
CREATE INDEX IF NOT EXISTS idx_returns_order ON public.returns(order_id);

ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "returns_owner_select" ON public.returns;
CREATE POLICY "returns_owner_select" ON public.returns FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_staff());
DROP POLICY IF EXISTS "returns_owner_insert" ON public.returns;
CREATE POLICY "returns_owner_insert" ON public.returns FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "returns_staff_update" ON public.returns;
CREATE POLICY "returns_staff_update" ON public.returns FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
