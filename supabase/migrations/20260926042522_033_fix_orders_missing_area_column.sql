-- Add missing 'area' column to orders table
-- The place_order function inserts p_area into orders.area but this column doesn't exist
-- This is the root cause of order placement failing

ALTER TABLE orders ADD COLUMN IF NOT EXISTS area text;
