/*
# 1. Customer-side RPC for accepting/rejecting custom order quotes
#    (column-level REVOKE on custom_orders.status prevents direct client writes)
#
# 2. RLS constraint: reviews INSERT must not allow approved=true
#    (Add a CHECK constraint and tighten the INSERT policy)
*/

-- ============================================================
-- 1. respond_to_quote — customer accepts or rejects a quote
-- ============================================================
CREATE OR REPLACE FUNCTION public.respond_to_quote(
  p_custom_order_id uuid,
  p_accept boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current text;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT status, user_id INTO v_current, v_user_id FROM custom_orders WHERE id = p_custom_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Custom order not found'; END IF;

  -- Verify ownership
  IF v_user_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  -- Must be in 'quoted' status
  IF v_current != 'quoted' THEN RAISE EXCEPTION 'Custom order is not in quoted state (current: %)', v_current; END IF;

  IF p_accept THEN
    UPDATE custom_orders SET status = 'accepted', updated_at = now() WHERE id = p_custom_order_id;
  ELSE
    UPDATE custom_orders SET status = 'rejected', updated_at = now() WHERE id = p_custom_order_id;
  END IF;

  INSERT INTO audit_logs (user_id, action, entity, entity_id, old_value, new_value)
  VALUES (auth.uid(), 'QUOTE_RESPONSE', 'custom_orders', p_custom_order_id,
    jsonb_build_object('status', v_current),
    jsonb_build_object('status', CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END));
END;
$function$;
-- Any authenticated user can call this (ownership is checked inside)
REVOKE EXECUTE ON FUNCTION public.respond_to_quote(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.respond_to_quote(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_quote(uuid, boolean) TO authenticated;

-- ============================================================
-- 2. Ensure reviews.approved defaults to false and can't be set true by INSERT
-- ============================================================

-- Add a NOT NULL DEFAULT false constraint if not already present
ALTER TABLE public.reviews ALTER COLUMN approved SET DEFAULT false;
ALTER TABLE public.reviews ALTER COLUMN approved SET NOT NULL;

-- Revoke INSERT permission on the approved column so users can't set it
REVOKE INSERT (approved) ON public.reviews FROM authenticated, anon;

-- ============================================================
-- 3. Ensure custom_orders INSERT must have status='requested'
--    (Add CHECK constraint if not present)
-- ============================================================
-- We can't add a check constraint that only applies on INSERT, but we can
-- ensure the RLS INSERT policy enforces this. The column-level REVOKE on
-- status UPDATE already prevents changing it. For INSERT, the policy
-- should check that status = 'requested' OR status IS NULL.

-- Check if a policy exists for custom_orders insert with status check
DO $do$
BEGIN
  -- Drop and recreate the insert policy to ensure it's correct
  DROP POLICY IF EXISTS custom_orders_insert ON public.custom_orders;
  CREATE POLICY custom_orders_insert ON public.custom_orders FOR INSERT
    TO authenticated WITH CHECK (auth.uid() = user_id AND (status = 'requested' OR status IS NULL));
END
$do$;

-- ============================================================
-- 4. Tighten reviews INSERT policy to prevent approved=true
-- ============================================================
DO $do$
BEGIN
  DROP POLICY IF EXISTS reviews_insert ON public.reviews;
  CREATE POLICY reviews_insert ON public.reviews FOR INSERT
    TO authenticated WITH CHECK (auth.uid() = user_id AND (approved = false OR approved IS NULL));
END
$do$;

-- ============================================================
-- 5. Tighten returns INSERT policy (customers can only create pending returns)
-- ============================================================
DO $do$
BEGIN
  DROP POLICY IF EXISTS returns_insert_own ON public.returns;
  CREATE POLICY returns_insert_own ON public.returns FOR INSERT
    TO authenticated WITH CHECK (auth.uid() = user_id AND (status = 'pending' OR status IS NULL));
END
$do$;

-- ============================================================
-- 6. Tighten order_change_requests INSERT policy
-- ============================================================
DO $do$
BEGIN
  DROP POLICY IF EXISTS order_change_requests_insert ON public.order_change_requests;
  CREATE POLICY order_change_requests_insert ON public.order_change_requests FOR INSERT
    TO authenticated WITH CHECK (auth.uid() = user_id AND (status = 'pending' OR status IS NULL));
END
$do$;
