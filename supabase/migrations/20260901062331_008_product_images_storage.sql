/*
# Product Images Storage Bucket

Creates a private storage bucket for product images uploaded by the owner.
Only authenticated staff (owner/admin) can upload, read, and delete images.
Customers can read product images publicly (they need to see product photos).

Bucket is public-read so customers can see product images without authentication,
but only staff can upload/delete.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Only staff can upload to product-images
CREATE POLICY "staff_upload_product_images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND public.is_staff()
);

-- Anyone can read product images (public bucket for product photos)
CREATE POLICY "public_read_product_images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'product-images');

-- Only staff can update product images
CREATE POLICY "staff_update_product_images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images' AND public.is_staff())
WITH CHECK (bucket_id = 'product-images' AND public.is_staff());

-- Only staff can delete product images
CREATE POLICY "staff_delete_product_images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images' AND public.is_staff());
