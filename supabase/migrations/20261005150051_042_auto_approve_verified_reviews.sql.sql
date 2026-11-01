/*
# Auto-approve verified purchase reviews + backfill existing

## Problem
Reviews are inserted with `approved = false` by default. The `set_verified_purchase` 
trigger sets `verified_purchase = true` for customers who actually bought the product, 
but does NOT set `approved = true`. So all 9 existing reviews remain pending forever 
and never appear on product pages (which query `.eq('approved', true)`).

## Fix
1. Modify the `set_verified_purchase` trigger function to also set `approved = true` 
   when the customer has a verified purchase. This means reviews from actual customers 
   appear immediately, while non-purchase reviews still require owner moderation.
2. Backfill all existing reviews where `verified_purchase = true` to `approved = true`.

## Security
- No RLS changes.
- No new tables.
- No data deletion.
- Owner can still hide/delete any review via `moderate_review()`.
*/

-- Backfill existing verified-purchase reviews
UPDATE reviews SET approved = true WHERE verified_purchase = true AND approved = false;

-- Recreate the trigger function to auto-approve verified purchases
CREATE OR REPLACE FUNCTION public.set_verified_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_has_purchase boolean := false;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.user_id = NEW.user_id
    AND oi.product_id = NEW.product_id
    AND o.status IN ('delivered', 'completed', 'shipped', 'out_for_delivery', 'confirmed', 'processing')
  ) INTO v_has_purchase;

  NEW.verified_purchase := v_has_purchase;
  NEW.approved := v_has_purchase;
  RETURN NEW;
END;
$function$;
