/*
  # Attachments System for Expenses and Payments

  1. New Storage
    - Creates a private storage bucket `attachments` for receipt/invoice files
    - Files organized by `{organization_id}/{entity_type}/{entity_id}/{filename}`

  2. New Tables
    - `attachments`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK organizations) - tenant scoping
      - `entity_type` (text) - 'general_expense', 'site_expense', or 'vendor_payment'
      - `entity_id` (uuid) - id of the related expense/payment
      - `kind` (text) - 'file' or 'link'
      - `file_name` (text) - original filename or link label
      - `file_path` (text, nullable) - storage path for files
      - `file_size` (bigint, nullable) - size in bytes
      - `mime_type` (text, nullable) - file content type
      - `external_url` (text, nullable) - URL for link references
      - `created_by` (uuid, FK auth.users)
      - `created_at` (timestamptz)

  3. Security
    - RLS enabled on `attachments` table
    - Members can SELECT/INSERT/DELETE attachments for their organization
    - Storage policies restrict bucket access to organization members
*/

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Attachments table
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('general_expense', 'site_expense', 'vendor_payment')),
  entity_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('file', 'link')),
  file_name text NOT NULL,
  file_path text,
  file_size bigint,
  mime_type text,
  external_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attachments_entity_idx ON attachments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS attachments_organization_idx ON attachments(organization_id);

ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view attachments" ON attachments;
CREATE POLICY "Members can view attachments"
  ON attachments FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can insert attachments" ON attachments;
CREATE POLICY "Members can insert attachments"
  ON attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can delete attachments" ON attachments;
CREATE POLICY "Members can delete attachments"
  ON attachments FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Storage policies for attachments bucket
DROP POLICY IF EXISTS "Members can view attachment files" ON storage.objects;
CREATE POLICY "Members can view attachment files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can upload attachment files" ON storage.objects;
CREATE POLICY "Members can upload attachment files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can delete attachment files" ON storage.objects;
CREATE POLICY "Members can delete attachment files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  );
