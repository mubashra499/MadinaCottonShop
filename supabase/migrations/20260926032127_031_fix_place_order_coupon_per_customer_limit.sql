/*
# Fix per-customer coupon limit check in place_order

## Root Cause
The `place_order` function uses `EXISTS(SELECT 1 FROM coupon_usage ...)` 
which blocks the coupon if the customer has used it even once.
But `per_customer_limit` can be > 1, meaning the customer should be
allowed to use the coupon multiple times up to that limit.

## Fix
Replace the EXISTS check with a COUNT check that compares actual 
usage count against `per_customer_limit`.
*/

CREATE OR REPLACE FUNCTION public.place_order(
  p_items jsonb,
  p_delivery_name text DEFAULT NULL,
  p_delivery_phone text DEFAULT NULL,
  p_delivery_email text DEFAULT NULL,
  p_country text DEFAULT NULL,
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
  p_gift_message text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_tracking_token text;
  v_subtotal numeric := 0;
  v_total numeric;
  v_item_price numeric;
  v_item_total numeric;
  v_item_quantity int;
  v_product record;
  v_variant record;
  v_item jsonb;
  v_coupon_id uuid;
  v_coupon_type text;
  v_coupon_value numeric;
  v_max_discount numeric;
  v_coupon_min_order numeric;
  v_coupon_per_limit int;
  v_new_stock int;
  v_new_variant_stock int;
  v_prev_stock int;
  v_prev_variant_stock int;
  v_discount numeric := 0;
  v_shipping numeric := 0;
  v_zone record;
  v_coupon_usage_count int;
  v_existing_response jsonb;
  v_product_id uuid;
  v_variant_id uuid;
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Idempotency check: if same key was used, return cached response
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT response INTO v_existing_response
    FROM public.idempotency_keys
    WHERE key = p_idempotency_key AND user_id = auth.uid();
    IF v_existing_response IS NOT NULL THEN
      RETURN v_existing_response;
    END IF;
  END IF;

  -- Validate items
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  -- Generate order number and tracking token
  v_order_number := 'MCS-' || UPPER(SUBSTRING(MD5(RANDOM()::text || CLOCK_TIMESTAMP()::text) FROM 1 FOR 8));
  v_tracking_token := REPLACE(GEN_RANDOM_UUID()::text, '-', '');

  -- Phase 1: Lock rows and calculate subtotal from DB prices
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_quantity := (v_item->>'quantity')::int;
    IF v_item_quantity IS NULL OR v_item_quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for product: %', v_item->>'product_id';
    END IF;

    v_product_id := (v_item->>'product_id')::uuid;

    -- Lock product row FOR UPDATE to prevent concurrent modification
    SELECT price, sale_price, stock, made_to_order, status, name
    INTO v_product
    FROM products WHERE id = v_product_id FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', v_item->>'product_id';
    END IF;

    IF v_product.status != 'active' THEN
      RAISE EXCEPTION 'Product not available: %', v_item->>'product_id';
    END IF;

    IF (v_item->>'variant_id') IS NOT NULL AND (v_item->>'variant_id') <> '' THEN
      v_variant_id := (v_item->>'variant_id')::uuid;

      -- Lock variant row FOR UPDATE
      SELECT price, sale_price, stock, size_label, weight, filling, fabric, color, design, stitching, decoration
      INTO v_variant
      FROM product_variants WHERE id = v_variant_id AND product_id = v_product_id FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Variant not found: %', v_item->>'variant_id';
      END IF;

      v_item_price := COALESCE(v_variant.sale_price, v_variant.price);
    ELSE
      v_item_price := COALESCE(v_product.sale_price, v_product.price);
    END IF;

    v_item_total := v_item_price * v_item_quantity;
    v_subtotal := v_subtotal + v_item_total;
  END LOOP;

  -- Phase 2: Server-side shipping fee
  IF p_delivery_zone_id IS NOT NULL THEN
    SELECT delivery_fee, min_order, free_delivery_threshold INTO v_zone
    FROM delivery_zones WHERE id = p_delivery_zone_id AND active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid delivery zone';
    END IF;

    IF v_zone.min_order IS NOT NULL AND v_subtotal < v_zone.min_order THEN
      RAISE EXCEPTION 'Order does not meet minimum amount for this delivery zone';
    END IF;

    IF v_zone.free_delivery_threshold IS NOT NULL AND v_subtotal >= v_zone.free_delivery_threshold THEN
      v_shipping := 0;
    ELSE
      v_shipping := COALESCE(v_zone.delivery_fee, 0);
    END IF;
  ELSE
    v_shipping := p_shipping_fee;
  END IF;

  -- Phase 3: Coupon validation (server-side)
  IF p_coupon_code IS NOT NULL AND p_coupon_code <> '' THEN
    SELECT id, discount_type, value, max_discount, min_order, per_customer_limit
    INTO v_coupon_id, v_coupon_type, v_coupon_value, v_max_discount, v_coupon_min_order, v_coupon_per_limit
    FROM coupons
    WHERE code = p_coupon_code
    AND active = true
    AND (start_date IS NULL OR start_date <= now())
    AND (end_date IS NULL OR end_date >= now())
    AND (usage_limit IS NULL OR usage_count < usage_limit)
    LIMIT 1;

    IF v_coupon_id IS NOT NULL THEN
      IF v_coupon_min_order IS NOT NULL AND v_subtotal < v_coupon_min_order THEN
        RAISE EXCEPTION 'Coupon requires minimum order of %', v_coupon_min_order;
      END IF;

      -- Check per-customer usage limit (count actual usage, not just existence)
      IF v_coupon_per_limit IS NOT NULL THEN
        SELECT COUNT(*) INTO v_coupon_usage_count
        FROM coupon_usage
        WHERE coupon_id = v_coupon_id AND user_id = auth.uid();

        IF v_coupon_usage_count >= v_coupon_per_limit THEN
          RAISE EXCEPTION 'Coupon already used maximum times by this customer';
        END IF;
      END IF;

      IF v_coupon_type = 'percentage' THEN
        v_discount := v_subtotal * (v_coupon_value / 100.0);
        IF v_max_discount IS NOT NULL THEN
          v_discount := LEAST(v_discount, v_max_discount);
        END IF;
      ELSIF v_coupon_type = 'fixed' THEN
        v_discount := v_coupon_value;
      ELSE
        v_discount := v_coupon_value;
      END IF;

      v_discount := LEAST(v_discount, v_subtotal);
    ELSE
      v_discount := 0;
    END IF;
  ELSE
    v_discount := 0;
  END IF;

  v_total := v_subtotal - v_discount + v_shipping;

  -- Phase 4: Create the order
  INSERT INTO orders (
    order_number, user_id, status, subtotal, discount, shipping_fee, total,
    currency, payment_method, payment_status,
    customer_name, customer_phone, customer_email,
    country, city, address, area, postal_code, landmark,
    delivery_instructions, notes,
    tracking_token, coupon_code, coupon_discount,
    is_gift, gift_recipient_name, gift_message
  ) VALUES (
    v_order_number, auth.uid(), 'new', v_subtotal, v_discount, v_shipping, v_total,
    'PKR', p_payment_method,
    CASE WHEN p_payment_method = 'cod' THEN 'pending' ELSE 'proof_submitted' END,
    p_delivery_name, p_delivery_phone, p_delivery_email,
    p_country, p_city, p_address, p_area, p_postal_code, p_landmark,
    p_delivery_instructions, p_notes,
    v_tracking_token, p_coupon_code, v_discount,
    p_is_gift, p_gift_recipient_name, p_gift_message
  ) RETURNING id INTO v_order_id;

  -- Phase 5: Create order items + atomically decrement stock (rows already locked)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_quantity := (v_item->>'quantity')::int;
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::uuid;

    SELECT name, made_to_order, stock INTO v_product FROM products WHERE id = v_product_id;

    IF v_variant_id IS NOT NULL THEN
      SELECT price, sale_price, stock, size_label, weight, filling, fabric, color, design, stitching, decoration
      INTO v_variant FROM product_variants WHERE id = v_variant_id;

      v_item_price := COALESCE(v_variant.sale_price, v_variant.price);
      v_prev_variant_stock := v_variant.stock;

      -- Atomic conditional decrement (rows locked, this is safe)
      UPDATE product_variants
      SET stock = stock - v_item_quantity
      WHERE id = v_variant_id
      AND stock >= v_item_quantity
      RETURNING stock INTO v_new_variant_stock;

      IF v_new_variant_stock IS NULL THEN
        RAISE EXCEPTION 'Insufficient stock for variant: % (available: %, requested: %)',
        v_variant_id, v_prev_variant_stock, v_item_quantity;
      END IF;

      -- Record stock movement
      INSERT INTO stock_movements (variant_id, product_id, change_type, quantity_change, previous_stock, new_stock, reason)
      VALUES (v_variant_id, v_product_id, 'sale', -v_item_quantity, v_prev_variant_stock, v_new_variant_stock, 'Order: ' || v_order_number);
    ELSE
      v_item_price := COALESCE(v_product.sale_price, v_product.price);
    END IF;

    -- Decrement product stock (unless made_to_order)
    IF NOT v_product.made_to_order THEN
      v_prev_stock := v_product.stock;

      UPDATE products
      SET stock = stock - v_item_quantity
      WHERE id = v_product_id
      AND stock >= v_item_quantity
      RETURNING stock INTO v_new_stock;

      IF v_new_stock IS NULL THEN
        RAISE EXCEPTION 'Insufficient stock for product: % (available: %, requested: %)',
        v_product_id, v_prev_stock, v_item_quantity;
      END IF;

      -- Record stock movement
      INSERT INTO stock_movements (product_id, change_type, quantity_change, previous_stock, new_stock, reason)
      VALUES (v_product_id, 'sale', -v_item_quantity, v_prev_stock, v_new_stock, 'Order: ' || v_order_number);
    END IF;

    INSERT INTO order_items (
      order_id, product_id, variant_id, product_name,
      size_label, weight, filling, fabric, color, design, stitching, decoration,
      quantity, unit_price
    ) VALUES (
      v_order_id, v_product_id, v_variant_id, v_product.name,
      v_variant.size_label, v_variant.weight, v_variant.filling, v_variant.fabric,
      v_variant.color, v_variant.design, v_variant.stitching, v_variant.decoration,
      v_item_quantity, v_item_price
    );
  END LOOP;

  -- Status history
  INSERT INTO order_status_history (order_id, status, notes, changed_by)
  VALUES (v_order_id, 'new', 'Order placed by customer', auth.uid());

  -- Coupon usage
  IF v_coupon_id IS NOT NULL THEN
    UPDATE coupons SET usage_count = usage_count + 1 WHERE id = v_coupon_id;
    INSERT INTO coupon_usage (coupon_id, user_id, order_id)
    VALUES (v_coupon_id, auth.uid(), v_order_id);
  END IF;

  -- Notify owner (only role='owner', not 'admin')
  INSERT INTO notifications (user_id, type, title, body, read)
  SELECT id, 'order', 'New Order: ' || v_order_number, 'Order from ' || COALESCE(p_delivery_name, 'Customer'), false
  FROM profiles WHERE role = 'owner';

  -- Build response
  v_existing_response := jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'tracking_token', v_tracking_token,
    'total', v_total
  );

  -- Store idempotency response
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    INSERT INTO idempotency_keys (key, user_id, response)
    VALUES (p_idempotency_key, auth.uid(), v_existing_response);
  END IF;

  RETURN v_existing_response;
END;
$function$;
