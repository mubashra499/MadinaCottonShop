/*
# Add customer-provided fabric support to custom_orders

## Changes
- `fabric_source` (text, default 'shop'): 'shop' = shop provides fabric, 'customer' = customer brings their own fabric
- `fabric_details` (text, nullable): customer can describe their fabric (type, color, quantity, notes) when they bring their own

## Security
- No RLS changes needed — existing custom_orders policies remain in place.
*/

ALTER TABLE custom_orders ADD COLUMN IF NOT EXISTS fabric_source text NOT NULL DEFAULT 'shop';
ALTER TABLE custom_orders ADD COLUMN IF NOT EXISTS fabric_details text;
