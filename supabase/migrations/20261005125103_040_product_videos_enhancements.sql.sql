/*
# Enhance product_videos table with primary, active, and thumbnail columns

1. Modified Tables
- `product_videos`
  - ADD `is_primary` (boolean, default false) — marks the main/hero video for a product
  - ADD `active` (boolean, default true) — owner can disable a video without deleting it
  - ADD `thumbnail_url` (text, nullable) — optional poster/cover image for the video

2. Security
- No RLS policy changes. Existing policies remain intact:
  - Public (anon + authenticated) can SELECT
  - Only staff (is_staff() role check) can INSERT/UPDATE/DELETE

3. Notes
- All additions use IF NOT EXISTS via DO block to be safe on re-run
- No data is lost — existing video rows get sensible defaults
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_videos' AND column_name = 'is_primary') THEN
    ALTER TABLE product_videos ADD COLUMN is_primary boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_videos' AND column_name = 'active') THEN
    ALTER TABLE product_videos ADD COLUMN active boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_videos' AND column_name = 'thumbnail_url') THEN
    ALTER TABLE product_videos ADD COLUMN thumbnail_url text;
  END IF;
END $$;