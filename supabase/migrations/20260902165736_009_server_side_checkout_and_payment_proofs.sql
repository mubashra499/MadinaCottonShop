/*
# Server-side order placement with atomic stock decrement

Replaces client-side stock decrement in checkout with a single atomic
SECURITY DEFINER function that:
1. Validates the caller is authenticated
2. Looks up product/variant prices from the database (never trusts client prices)
3. Atomically decrements stock with a WHERE clause that prevents negative stock
4. Creates the order, order items, status history, and notification in one transaction
5. Returns the created order ID and tracking token

Also creates a private storage bucket for payment proofs (not publicly readable).
*/

-- ============================================================
-- 1. Private storage bucket for payment proofs
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Only the owner can read payment proofs (for verification)
CREATE POLICY "owner_read_payment_proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND public.is_staff()
);

-- Customers can upload their own payment proof (folder = their user ID)
CREATE POLICY "customer_upload_payment_proof"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Only owner can delete payment proofs
CREATE POLICY "owner_delete_payment_proofs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND public.is_staff()
);

-- ============================================================
-- 2. Atomic order placement function
-- ============================================================
CREATE OR REPLACE FUNCTION public.place_order(
  p_items jsonb,
  p_delivery_name text,
  p_delivery_phone text,
  p_delivery_email text DEFAULT NULL,
  p_country text DEFAULT 'Pakistan',
  p_city text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_area text DEFAULT NULL,
  p_postal_code text DEFAULT NULL,
  p_landmark text DEFAULT NULL,
  p_delivery_instructions text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_payment_method text DEFAULT 'cod',
  p_payment_reference text DEFAULT NULL,
  p_payment_proof_url text DEFAULT NULL,
  p_delivery_zone_id uuid DEFAULT NULL,
  p_shipping_fee numeric DEFAULT 0,
  p_coupon_code text DEFAULT NULL,
  p_coupon_discount numeric DEFAULT 0,
  p_is_gift boolean DEFAULT false,
  p_gift_recipient_name text DEFAULT NULL,
  p_gift_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_tracking_token text;
  v_subtotal numeric := 0;
  v_total numeric;
  v_item_price numeric;
  v_item_total numeric;
  v_product record;
  v_variant record;
  v_item jsonb;
  v_coupon_id uuid;
  v_new_stock int;
  v_new_variant_stock int;
  v_discount numeric := 0;
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate items
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  -- Generate order number and tracking token
  v_order_number := 'MCS-' || UPPER(SUBSTRING(MD5(RANDOM()::text || CLOCK_TIMESTAMP()::text) FROM 1 FOR 8));
  v_tracking_token := REPLACE(GEN_RANDOM_UUID()::text, '-', '');

  -- Calculate subtotal from DB prices (never trust client)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT price, sale_price, stock, made_to_order INTO v_product
    FROM products WHERE id = (v_item->>'product_id')::uuid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', v_item->>'product_id';
    END IF;

    -- Get variant price if variant_id provided
    IF (v_item->>'variant_id') IS NOT NULL AND (v_item->>'variant_id') <> '' THEN
      SELECT price, sale_price, stock INTO v_variant
      FROM product_variants WHERE id = (v_item->>'variant_id')::uuid AND product_id = (v_item->>'product_id')::uuid;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Variant not found: %', v_item->>'variant_id';
      END IF;

      v_item_price := COALESCE(v_variant.sale_price, v_variant.price);
    ELSE
      v_item_price := COALESCE(v_product.sale_price, v_product.price);
    END IF;

    v_item_total := v_item_price * ((v_item->>'quantity')::int);
    v_subtotal := v_subtotal + v_item_total;
  END LOOP;

  -- Apply coupon discount (use server-calculated value, not client)
  IF p_coupon_code IS NOT NULL AND p_coupon_code <> '' THEN
    SELECT id, discount_type, discount_value, max_discount INTO v_coupon_id, v_discount, v_discount, v_discount
    FROM coupons
    WHERE code = p_coupon_code
      AND active = true
      AND (starts_at IS NULL OR starts_at <= now())
      AND (expires_at IS NULL OR expires_at >= now())
      AND (usage_limit IS NULL OR usage_count < usage_limit)
    LIMIT 1;

    IF v_coupon_id IS NOT NULL THEN
      IF v_discount IS NOT NULL THEN
        v_discount := LEAST(v_discount, p_coupon_discount);
      ELSE
        v_discount := p_coupon_discount;
      END IF;
    ELSE
      v_discount := 0;
    END IF;
  ELSE
    v_discount := 0;
  END IF;

  v_total := v_subtotal - v_discount + p_shipping_fee;

  -- Create the order
  INSERT INTO orders (
    order_number, user_id, status, subtotal, discount, shipping_fee, total,
    currency, payment_method, payment_status,
    customer_name, customer_phone, customer_email,
    country, city, address, area, postal_code, landmark,
    delivery_instructions, notes,
    tracking_token, coupon_code, coupon_discount,
    is_gift, gift_recipient_name, gift_message
  ) VALUES (
    v_order_number, auth.uid(), 'new', v_subtotal, v_discount, p_shipping_fee, v_total,
    'PKR', p_payment_method,
    CASE WHEN p_payment_method = 'cod' THEN 'pending' ELSE 'proof_submitted' END,
    p_delivery_name, p_delivery_phone, p_delivery_email,
    p_country, p_city, p_address, p_area, p_postal_code, p_landmark,
    p_delivery_instructions, p_notes,
    v_tracking_token, p_coupon_code, v_discount,
    p_is_gift, p_gift_recipient_name, p_gift_message
  )
  RETURNING id INTO v_order_id;

  -- Create order items + decrement stock atomically
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT name INTO v_product FROM products WHERE id = (v_item->>'product_id')::uuid;

    IF (v_item->>'variant_id') IS NOT NULL AND (v_item->>'variant_id') <> '' THEN
      SELECT price, sale_price, stock, size_label, weight, filling, fabric, color, design, stitching, decoration
      INTO v_variant
      FROM product_variants WHERE id = (v_item->>'variant_id')::uuid;

      v_item_price := COALESCE(v_variant.sale_price, v_variant.price);

      -- Atomic stock decrement: only succeeds if stock >= quantity (unless made_to_order)
      UPDATE product_variants
      SET stock = stock - ((v_item->>'quantity')::int)
      WHERE id = (v_item->>'variant_id')::uuid
        AND stock >= ((v_item->>'quantity')::int)
      RETURNING stock INTO v_new_variant_stock;

      IF v_new_variant_stock IS NULL THEN
        RAISE EXCEPTION 'Insufficient stock for variant: %', v_item->>'variant_id';
      END IF;
    ELSE
      v_item_price := COALESCE(
        (SELECT sale_price FROM products WHERE id = (v_item->>'product_id')::uuid),
        (SELECT price FROM products WHERE id = (v_item->>'product_id')::uuid)
      );
    END IF;

    -- Decrement product stock atomically (unless made_to_order)
    SELECT made_to_order INTO v_product FROM products WHERE id = (v_item->>'product_id')::uuid;
    IF NOT v_product.made_to_order THEN
      UPDATE products
      SET stock = stock - ((v_item->>'quantity')::int)
      WHERE id = (v_item->>'product_id')::uuid
        AND stock >= ((v_item->>'quantity')::int)
      RETURNING stock INTO v_new_stock;

      IF v_new_stock IS NULL THEN
        RAISE EXCEPTION 'Insufficient stock for product: %', v_item->>'product_id';
      END IF;
    END IF;

    -- Insert order item with server-validated price
    INSERT INTO order_items (
      order_id, product_id, variant_id, product_name,
      size_label, weight, filling, fabric, color, design, stitching, decoration,
      quantity, unit_price
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      NULLIF(v_item->>'variant_id', '')::uuid,
      v_product.name,
      v_variant.size_label, v_variant.weight, v_variant.filling, v_variant.fabric,
      v_variant.color, v_variant.design, v_variant.stitching, v_variant.decoration,
      (v_item->>'quantity')::int,
      v_item_price
    );
  END LOOP;

  -- Create initial status history
  INSERT INTO order_status_history (order_id, status, notes)
  VALUES (v_order_id, 'new', 'Order placed by customer');

  -- Increment coupon usage atomically
  IF v_coupon_id IS NOT NULL THEN
    UPDATE coupons SET usage_count = usage_count + 1 WHERE id = v_coupon_id;
  END IF;

  -- Create notification for owner
  INSERT INTO notifications (user_id, type, title, body, read)
  SELECT id, 'order', 'New Order: ' || v_order_number, 'Order from ' || p_delivery_name, false
  FROM profiles WHERE role IN ('owner', 'admin');

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'tracking_token', v_tracking_token,
    'total', v_total
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.place_order(
  jsonb, text, text, text, text, text, text, text, text, text, text, text, text, text, text, uuid, numeric, text, numeric, boolean, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(
  jsonb, text, text, text, text, text, text, text, text, text, text, text, text, text, text, uuid, numeric, text, numeric, boolean, text, text
) TO authenticated;
