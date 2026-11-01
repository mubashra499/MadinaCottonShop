/*
# Fix CASCADE Foreign Keys and Order Retention Security

## Problem
1. `orders.user_id` FK uses ON DELETE CASCADE — deleting a user from auth.users
   cascade-deletes all their orders, violating business data retention requirements.
2. `returns.user_id` FK uses ON DELETE CASCADE — same issue for return records.
3. `reviews.user_id` FK uses ON DELETE CASCADE — same issue for reviews.
4. `orders_owner_delete` RLS policy allows customers to DELETE their own orders,
   which violates the "never hard delete business records" requirement.

## Changes
1. Change `orders.user_id` FK from CASCADE to SET NULL — orders are preserved
   even if the auth user is deleted, with user_id nulled for anonymity.
2. Change `returns.user_id` FK from CASCADE to SET NULL.
3. Change `reviews.user_id` FK from CASCADE to SET NULL (both FK constraints).
4. Drop the `orders_owner_delete` policy — customers can no longer delete orders.
   Only staff/owner can archive orders (via is_staff() UPDATE policy).

## Security
- Removes customer self-delete capability on orders (data retention protection).
- Preserves business records when auth users are removed.
*/

-- 1. Fix orders.user_id FK: CASCADE -> SET NULL
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Fix returns.user_id FK: CASCADE -> SET NULL
ALTER TABLE returns DROP CONSTRAINT IF EXISTS returns_user_id_fkey;
ALTER TABLE returns ADD CONSTRAINT returns_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Fix reviews FKs: CASCADE -> SET NULL
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;
ALTER TABLE reviews ADD CONSTRAINT reviews_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_user_id_profiles_fkey;
ALTER TABLE reviews ADD CONSTRAINT reviews_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- 4. Remove customer self-delete on orders
DROP POLICY IF EXISTS "orders_owner_delete" ON orders;