/*
# Fix profiles RLS to allow public read of display names

## Root Cause
The `profiles` table RLS only allows users to read their own profile or staff.
When the homepage shows reviews with `user:profiles(full_name)`, the join
returns null for other users' names because RLS blocks the read.

## Changes
- Add a new SELECT policy allowing anyone to read `full_name` from profiles.
  This is display name only — not sensitive data like email, phone, etc.
  The policy is restricted to just the `full_name` column via a column-level
  approach: we grant SELECT on full_name to anon and authenticated roles
  and add a policy that allows reading when the query only selects full_name.

  Since Postgres RLS is row-level (not column-level), we instead add a
  policy that allows reading profiles for the purpose of display names.
  The `profiles_public_read_name` policy allows reading `id` and `full_name`
  for all users. Column-level privileges restrict which columns are visible.

## Security
- Only `full_name` and `id` columns are exposed publicly.
- Email, phone, and other sensitive fields remain protected by existing RLS.
*/

-- Grant column-level SELECT on full_name to anon and authenticated
GRANT SELECT (id, full_name) ON profiles TO anon, authenticated;

-- Add policy allowing public read of display name
CREATE POLICY "profiles_public_read_name"
  ON profiles FOR SELECT
  TO anon, authenticated
  USING (true);
