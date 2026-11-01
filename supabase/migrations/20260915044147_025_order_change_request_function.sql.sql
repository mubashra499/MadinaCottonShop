/*
# Add server function for order change request resolution
# (column-level REVOKE on order_change_requests.status prevents direct writes)
*/

CREATE OR REPLACE FUNCTION public.resolve_order_change_request(
  p_request_id uuid,
  p_approve boolean,
  p_owner_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_user_id := auth.uid();

  IF p_approve THEN
    UPDATE order_change_requests SET status = 'approved', owner_note = p_owner_note, updated_at = now() WHERE id = p_request_id AND status = 'pending';
  ELSE
    UPDATE order_change_requests SET status = 'rejected', owner_note = p_owner_note, updated_at = now() WHERE id = p_request_id AND status = 'pending';
  END IF;

  IF NOT FOUND THEN RAISE EXCEPTION 'Change request not found or not pending'; END IF;

  INSERT INTO audit_logs (user_id, action, entity, entity_id, new_value)
  VALUES (v_user_id, 'CHANGE_REQUEST_RESOLVED', 'order_change_requests', p_request_id,
    jsonb_build_object('approved', p_approve, 'owner_note', p_owner_note));
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.resolve_order_change_request(uuid, boolean, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_order_change_request(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_order_change_request(uuid, boolean, text) TO authenticated;
