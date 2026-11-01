/*
# Fix reviews -> profiles relationship for PostgREST join

## Root Cause
`reviews.user_id` has a FK to `auth.users(id)`, but the frontend query uses
`user:profiles(full_name)` which requires a direct FK from `reviews.user_id`
to `profiles.id`. Without it, PostgREST returns HTTP 400.

## Changes
- Add FK constraint: reviews.user_id -> profiles(id) ON DELETE CASCADE
  (profiles.id itself references auth.users.id, so this is safe)

## Security
- No RLS changes needed.
*/

ALTER TABLE reviews
  ADD CONSTRAINT reviews_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
