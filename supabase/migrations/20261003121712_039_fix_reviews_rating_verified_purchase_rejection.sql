/*
# Fix Reviews Rating Aggregation, Verified Purchase, and Payment Rejection Reason

## Problems
1. Product `avg_rating` and `review_count` never update when reviews are approved/rejected —
   so the product page always shows "No reviews yet" even after approval.
2. `verified_purchase` is always `false` because nothing checks purchase history when a review is submitted.
3. Payments table has no `rejection_reason` column — owner can reject but reason isn't stored.

## Changes
1. Add trigger `update_product_rating_on_review_change` that recalculates `avg_rating` and
   `review_count` on the products table whenever a review's `approved` status changes or a
   review is inserted/deleted. Only counts approved reviews.
2. Add trigger `set_verified_purchase_on_review_insert` that checks if the reviewing user
   has a delivered/completed order containing the reviewed product. Sets `verified_purchase = true`.
3. Add `rejection_reason` column to `payments` table.

## Security
- Triggers run with SECURITY DEFINER to read orders/order_items (which belong to other users).
- The verified_purchase trigger only reads data, doesn't modify user-controlled fields.
- No new RLS policies needed — existing policies cover all tables.
*/

-- 1. Add rejection_reason column to payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS rejection_reason text;

-- 2. Function to recalculate product rating from approved reviews
CREATE OR REPLACE FUNCTION public.update_product_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id uuid;
  v_avg numeric;
  v_count int;
BEGIN
  -- Determine product_id from the review that changed
  IF TG_OP = 'DELETE' THEN
    v_product_id := OLD.product_id;
  ELSE
    v_product_id := NEW.product_id;
  END IF;

  -- Recalculate from approved reviews only
  SELECT COALESCE(AVG(rating), 0), COUNT(*)
  INTO v_avg, v_count
  FROM reviews
  WHERE product_id = v_product_id AND approved = true;

  UPDATE products
  SET avg_rating = ROUND(v_avg, 2),
      review_count = v_count
  WHERE id = v_product_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_update_product_rating ON reviews;
CREATE TRIGGER trg_update_product_rating
  AFTER INSERT OR UPDATE OF approved OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_product_rating();

-- 3. Function to set verified_purchase based on actual order history
CREATE OR REPLACE FUNCTION public.set_verified_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_purchase boolean := false;
BEGIN
  -- Check if this user has a delivered/completed order with this product
  SELECT EXISTS(
    SELECT 1
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.user_id = NEW.user_id
      AND oi.product_id = NEW.product_id
      AND o.status IN ('delivered', 'completed', 'shipped', 'out_for_delivery', 'confirmed', 'processing')
  ) INTO v_has_purchase;

  NEW.verified_purchase := v_has_purchase;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_set_verified_purchase ON reviews;
CREATE TRIGGER trg_set_verified_purchase
  BEFORE INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_verified_purchase();

-- 4. Grant execute to authenticated (needed for trigger to fire on user inserts)
-- Triggers fire automatically regardless of EXECUTE privileges, but be explicit
GRANT EXECUTE ON FUNCTION public.update_product_rating() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_verified_purchase() TO authenticated;