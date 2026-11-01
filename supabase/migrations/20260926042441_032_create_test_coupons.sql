-- Create test coupons for end-to-end testing
-- These are real coupons that can be used by customers

-- Percentage discount coupon: 10% off, min order 1000, max discount 500
INSERT INTO coupons (code, name, discount_type, value, min_order, max_discount, usage_limit, per_customer_limit, max_usage_per_customer, active, auto_apply, target_type)
VALUES ('SAVE10', '10% Off Your Order', 'percentage', 10, 1000, 500, 100, 1, 1, true, false, null)
ON CONFLICT (code) DO NOTHING;

-- Fixed discount coupon: Rs 200 off, min order 1500
INSERT INTO coupons (code, name, discount_type, value, min_order, max_discount, usage_limit, per_customer_limit, max_usage_per_customer, active, auto_apply, target_type)
VALUES ('FLAT200', 'Rs 200 Off', 'fixed', 200, 1500, null, 100, 2, 2, true, false, null)
ON CONFLICT (code) DO NOTHING;

-- First-order only coupon: 15% off, first order only
INSERT INTO coupons (code, name, discount_type, value, min_order, max_discount, usage_limit, per_customer_limit, max_usage_per_customer, active, auto_apply, target_type)
VALUES ('FIRST15', '15% First Order Discount', 'percentage', 15, 500, 1000, 100, 1, 1, true, false, 'first_order')
ON CONFLICT (code) DO NOTHING;

-- Auto-apply promotion: 5% off orders over 2000
INSERT INTO coupons (code, name, discount_type, value, min_order, max_discount, usage_limit, per_customer_limit, max_usage_per_customer, active, auto_apply, priority, target_type)
VALUES ('AUTO5', 'Auto 5% Off Over 2000', 'percentage', 5, 2000, 300, 100, 1, 1, true, true, 10, null)
ON CONFLICT (code) DO NOTHING;

-- Expired coupon (for negative testing)
INSERT INTO coupons (code, name, discount_type, value, min_order, max_discount, usage_limit, per_customer_limit, max_usage_per_customer, active, auto_apply, start_date, end_date, target_type)
VALUES ('EXPIRED50', 'Expired Coupon', 'fixed', 50, 0, null, 100, 1, 1, true, false, '2026-01-01', '2026-08-01', null)
ON CONFLICT (code) DO NOTHING;

-- Inactive coupon (for negative testing)
INSERT INTO coupons (code, name, discount_type, value, min_order, max_discount, usage_limit, per_customer_limit, max_usage_per_customer, active, auto_apply, target_type)
VALUES ('INACTIVE99', 'Inactive Coupon', 'percentage', 99, 0, null, 100, 1, 1, false, false, null)
ON CONFLICT (code) DO NOTHING;
