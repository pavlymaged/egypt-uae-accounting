
-- Allow client portal users to download attachment files for their expenses
CREATE POLICY "client_portal_download_attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'attachments'
  AND EXISTS (
    SELECT 1 FROM client_portal_users cpu
    WHERE cpu.user_id = auth.uid() AND cpu.is_active = true
  )
);
