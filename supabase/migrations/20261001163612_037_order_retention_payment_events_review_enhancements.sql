/*
# Order Data Retention, Payment Events, and Review Enhancements

## Purpose
This migration ensures complete business data retention and adds missing audit/review features.

## Changes

### 1. Order Archiving (Soft Delete)
- Adds `is_archived` (boolean, default false) and `archived_at` (timestamptz) columns to `orders`

### 2. Foreign Key Safety - Prevent Accidental Data Loss
- Changes CASCADE to RESTRICT on order_items.order_id, payments.order_id, order_status_history.order_id, returns.order_id, order_change_requests.order_id
- Changes order_items.product_id and variant_id from SET NULL to RESTRICT

### 3. Payment Events Table (Audit Trail)
- New `payment_events` table to track every payment state change

### 4. Review Enhancements
- Adds verified_purchase, helpful_count, owner_reply, owner_reply_at, reported_count to reviews

### 5. Review Reports Table
- New `review_reports` table for reporting inappropriate reviews

### 6. Review Images Table
- New `review_images` table for customer-uploaded review photos

### 7. Review Helpful Votes Table
- New `review_helpful_votes` table (one vote per user per review)
*/

-- ============================================================
-- 1. ORDER ARCHIVING
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'is_archived') THEN
    ALTER TABLE orders ADD COLUMN is_archived boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'archived_at') THEN
    ALTER TABLE orders ADD COLUMN archived_at timestamptz;
  END IF;
END $$;

-- ============================================================
-- 2. FOREIGN KEY SAFETY
-- ============================================================
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_variant_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_variant_id_fkey
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_order_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;

ALTER TABLE order_status_history DROP CONSTRAINT IF EXISTS order_status_history_order_id_fkey;
ALTER TABLE order_status_history ADD CONSTRAINT order_status_history_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;

ALTER TABLE returns DROP CONSTRAINT IF EXISTS returns_order_id_fkey;
ALTER TABLE returns ADD CONSTRAINT returns_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;

ALTER TABLE order_change_requests DROP CONSTRAINT IF EXISTS order_change_requests_order_id_fkey;
ALTER TABLE order_change_requests ADD CONSTRAINT order_change_requests_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;

-- ============================================================
-- 3. PAYMENT EVENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  previous_status text,
  new_status text,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id ON payment_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_created_at ON payment_events(created_at DESC);

ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_payment_events" ON payment_events;
CREATE POLICY "select_own_payment_events" ON payment_events FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM payments p
      JOIN orders o ON o.id = p.order_id
      WHERE p.id = payment_events.payment_id AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "owner_select_all_payment_events" ON payment_events;
CREATE POLICY "owner_select_all_payment_events" ON payment_events FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- ============================================================
-- 4. REVIEW ENHANCEMENTS
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'verified_purchase') THEN
    ALTER TABLE reviews ADD COLUMN verified_purchase boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'helpful_count') THEN
    ALTER TABLE reviews ADD COLUMN helpful_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'owner_reply') THEN
    ALTER TABLE reviews ADD COLUMN owner_reply text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'owner_reply_at') THEN
    ALTER TABLE reviews ADD COLUMN owner_reply_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'reported_count') THEN
    ALTER TABLE reviews ADD COLUMN reported_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ============================================================
-- 5. REVIEW REPORTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE RESTRICT,
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_reports_review_id ON review_reports(review_id);
CREATE INDEX IF NOT EXISTS idx_review_reports_status ON review_reports(status);

ALTER TABLE review_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_review_reports" ON review_reports;
CREATE POLICY "insert_review_reports" ON review_reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "select_own_review_reports" ON review_reports;
CREATE POLICY "select_own_review_reports" ON review_reports FOR SELECT
  TO authenticated USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "owner_select_all_review_reports" ON review_reports;
CREATE POLICY "owner_select_all_review_reports" ON review_reports FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
  );

DROP POLICY IF EXISTS "owner_update_review_reports" ON review_reports;
CREATE POLICY "owner_update_review_reports" ON review_reports FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- ============================================================
-- 6. REVIEW IMAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS review_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_images_review_id ON review_images(review_id);

ALTER TABLE review_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_review_images" ON review_images;
CREATE POLICY "public_select_review_images" ON review_images FOR SELECT
  TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM reviews WHERE reviews.id = review_images.review_id AND reviews.approved = true)
  );

DROP POLICY IF EXISTS "insert_own_review_images" ON review_images;
CREATE POLICY "insert_own_review_images" ON review_images FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM reviews WHERE reviews.id = review_id AND reviews.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "owner_select_all_review_images" ON review_images;
CREATE POLICY "owner_select_all_review_images" ON review_images FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
  );

DROP POLICY IF EXISTS "owner_delete_review_images" ON review_images;
CREATE POLICY "owner_delete_review_images" ON review_images FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- ============================================================
-- 7. REVIEW HELPFUL VOTES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS review_helpful_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(review_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_review_helpful_votes_review_id ON review_helpful_votes(review_id);

ALTER TABLE review_helpful_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_helpful_votes" ON review_helpful_votes;
CREATE POLICY "insert_helpful_votes" ON review_helpful_votes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_helpful_votes" ON review_helpful_votes;
CREATE POLICY "select_own_helpful_votes" ON review_helpful_votes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_helpful_votes" ON review_helpful_votes;
CREATE POLICY "delete_own_helpful_votes" ON review_helpful_votes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "public_count_helpful_votes" ON review_helpful_votes;
CREATE POLICY "public_count_helpful_votes" ON review_helpful_votes FOR SELECT
  TO anon, authenticated USING (true);
