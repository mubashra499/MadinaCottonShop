/*
# Add auto-apply promotion fields to coupons table

## Changes
1. New columns on `coupons`:
   - `name` (text) — human-readable promotion name (e.g. "First Order 10% Off")
   - `auto_apply` (boolean, default false) — when true, the promotion is automatically applied at checkout without the customer needing to enter a code
   - `priority` (integer, default 0) — higher priority promotions are evaluated first when multiple auto-apply promotions exist
   - `free_delivery` (boolean, default false) — when true, grants free shipping in addition to the discount
   - `target_type` (text, nullable) — restricts what the promotion applies to: 'all', 'first_order', or null (treat as 'all')
   - `max_usage_per_customer` (integer) — alias for per_customer_limit, kept for clarity (default 1)

## Security
- No RLS changes needed — existing coupon policies remain in place.
- Only the owner role can manage coupons (existing behavior).

## Notes
- `auto_apply = true` means the checkout automatically evaluates this coupon without a code entry.
- `target_type = 'first_order'` restricts to customers with zero prior orders.
- `priority` controls evaluation order; the first matching auto-apply promotion wins.
*/

ALTER TABLE coupons ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS auto_apply boolean NOT NULL DEFAULT false;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS free_delivery boolean NOT NULL DEFAULT false;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS target_type text DEFAULT 'all';
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS max_usage_per_customer integer NOT NULL DEFAULT 1;

-- Backfill name from code for existing rows
UPDATE coupons SET name = code WHERE name IS NULL;
