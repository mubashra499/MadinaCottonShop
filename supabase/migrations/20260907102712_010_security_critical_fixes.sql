/*
# Security Critical Fixes — Privilege Escalation, RLS Policy Hardening

## Summary
This migration fixes the most critical security vulnerabilities found during audit:
1. Profiles role privilege escalation (CRITICAL) — any user could set their own role to 'owner'
2. Loyalty points self-award (HIGH) — users could insert points for themselves
3. Reviews self-approval (MEDIUM) — users could approve their own reviews
4. Questions self-approval (MEDIUM) — users could approve their own questions
5. Messages leak (HIGH) — customers could see staff-to-staff messages
6. Notifications INSERT allows targeting other users (MEDIUM)
7. Support messages sender spoofing (MEDIUM)
8. Order tracking token uniqueness (MEDIUM)

## Changes

### 1. profiles.role CHECK constraint + column-level privilege
- Add CHECK constraint limiting role to 'customer', 'admin', 'owner'
- Revoke UPDATE(role) from authenticated so users cannot escalate themselves

### 2. loyalty_points INSERT — staff only
- Drop the old policy that allowed auth.uid() = user_id
- Create new INSERT policy requiring is_staff()

### 3. reviews UPDATE — split into owner-update (no approved column) and staff-update
- Drop old permissive UPDATE policy
- Revoke UPDATE(approved) from authenticated so users can't self-approve
- Staff can update any review including approved

### 4. questions UPDATE — split owner vs staff
- Drop old permissive UPDATE policy
- Revoke UPDATE(approved, answered_by, answer) from authenticated
- Staff can update any question

### 5. messages SELECT — restrict customer to only their own messages
- Drop old policy that leaked staff messages
- Customer sees all messages where user_id = auth.uid() (their own thread)
- Staff sees messages where sender = 'customer' (inbound)

### 6. notifications INSERT — restrict to self only (no targeting others)
- Drop old policy allowing OR is_staff()
- New policy: auth.uid() = user_id only (staff uses service role / RPC)

### 7. support_messages INSERT — prevent sender spoofing
- Drop old policy
- New policy: auth.uid() = user_id AND sender = 'customer' (customers can only send as customer)

### 8. orders.tracking_token — add UNIQUE constraint
- Prevents token collisions
*/

-- ============================================================
-- 1. profiles.role: CHECK constraint + revoke UPDATE on role
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check' AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('customer', 'admin', 'owner'));
  END IF;
END $$;

REVOKE UPDATE (role) ON profiles FROM authenticated, anon;

-- ============================================================
-- 2. loyalty_points: INSERT — staff only (no self-award)
-- ============================================================
DROP POLICY IF EXISTS "loyalty_staff_insert" ON loyalty_points;
CREATE POLICY "loyalty_staff_insert" ON loyalty_points FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff());

-- ============================================================
-- 3. reviews: UPDATE — split owner vs staff
-- ============================================================
DROP POLICY IF EXISTS "reviews_staff_update" ON reviews;
DROP POLICY IF EXISTS "reviews_owner_update" ON reviews;

-- Revoke UPDATE on approved column so users can't self-approve
REVOKE UPDATE (approved) ON reviews FROM authenticated;

CREATE POLICY "reviews_owner_update" ON reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_staff_update" ON reviews FOR UPDATE
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- ============================================================
-- 4. questions: UPDATE — split owner vs staff
-- ============================================================
DROP POLICY IF EXISTS "questions_staff_update" ON questions;
DROP POLICY IF EXISTS "questions_owner_update" ON questions;

REVOKE UPDATE (approved, answered_by, answer) ON questions FROM authenticated;

CREATE POLICY "questions_owner_update" ON questions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "questions_staff_update" ON questions FOR UPDATE
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- ============================================================
-- 5. messages: SELECT — restrict customer to own thread only
-- ============================================================
DROP POLICY IF EXISTS "messages_owner_select" ON messages;
DROP POLICY IF EXISTS "messages_staff_select" ON messages;

CREATE POLICY "messages_owner_select" ON messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "messages_staff_select" ON messages FOR SELECT
  TO authenticated
  USING (public.is_staff() AND sender = 'customer');

-- ============================================================
-- 6. notifications: INSERT — self only
-- ============================================================
DROP POLICY IF EXISTS "notifications_owner_insert" ON notifications;
CREATE POLICY "notifications_owner_insert" ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 7. support_messages: INSERT — prevent sender spoofing
-- ============================================================
DROP POLICY IF EXISTS "support_messages_owner_insert" ON support_messages;
DROP POLICY IF EXISTS "support_messages_staff_insert" ON support_messages;

CREATE POLICY "support_messages_owner_insert" ON support_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND sender = 'customer');
CREATE POLICY "support_messages_staff_insert" ON support_messages FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff() AND sender = 'staff');

-- ============================================================
-- 8. orders.tracking_token — UNIQUE constraint
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_tracking_token_unique' AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_tracking_token_unique UNIQUE (tracking_token);
  END IF;
END $$;
