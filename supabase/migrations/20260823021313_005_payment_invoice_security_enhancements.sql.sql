-- Add tracking token to orders for secure lookup
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_token text DEFAULT encode(gen_random_bytes(12), 'hex');

-- Add payment proof fields to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS transaction_ref text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS proof_url text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id);

-- Add cost fields to products for profit calculation (owner-only via RLS column privileges)
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price numeric DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS labor_cost numeric DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS material_cost numeric DEFAULT 0;

-- Add gift fields to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_gift boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_recipient_name text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_message text;

-- Order status history table
CREATE TABLE IF NOT EXISTS order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  notes text,
  changed_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_status_history_owner_select" ON order_status_history
  FOR SELECT TO authenticated USING (auth.uid() = (SELECT user_id FROM orders WHERE id = order_id));
CREATE POLICY "order_status_history_staff_insert" ON order_status_history
  FOR INSERT TO authenticated WITH CHECK (is_staff());
CREATE POLICY "order_status_history_staff_select" ON order_status_history
  FOR SELECT TO authenticated USING (is_staff());

-- Backfill tracking tokens for existing orders
UPDATE orders SET tracking_token = encode(gen_random_bytes(12), 'hex') WHERE tracking_token IS NULL;

-- Add coupon_id and coupon_code to orders for tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_discount numeric DEFAULT 0;

-- Add usage tracking columns to coupons (if not already present)
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS per_customer_limit integer DEFAULT 1;

-- Create coupon_usage table to track per-customer usage
CREATE TABLE IF NOT EXISTS coupon_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(coupon_id, user_id)
);

ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coupon_usage_owner_select" ON coupon_usage
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "coupon_usage_staff_all" ON coupon_usage
  FOR ALL TO authenticated USING (is_staff()) WITH CHECK (is_staff());
CREATE POLICY "coupon_usage_owner_insert" ON coupon_usage
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_orders_tracking_token ON orders(tracking_token);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon_user ON coupon_usage(coupon_id, user_id);

-- Add production progress tracking columns to production_orders
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS progress integer DEFAULT 0;
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS stage_notes text;
ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS expected_completion date;

-- Add low_stock_email_sent flag to prevent duplicate alerts
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_alert_sent boolean DEFAULT false;

-- Owner notification settings
INSERT INTO settings (key, value) VALUES ('owner_email_notifications', 'true')
ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('low_stock_threshold_default', '5')
ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('large_order_threshold', '10000')
ON CONFLICT (key) DO NOTHING;

-- Revoke column-level access to cost fields (owner-only)
-- Cost price, labor cost, material cost should only be visible to staff
REVOKE UPDATE (cost_price, labor_cost, material_cost) ON products FROM anon, authenticated;
