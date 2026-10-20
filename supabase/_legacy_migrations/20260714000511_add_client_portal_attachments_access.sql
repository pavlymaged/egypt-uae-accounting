/*
  # Client Portal: Attachments Access & Quotation Entity Type

  1. Changes
    - Add 'vendor_quotation' to the attachments entity_type CHECK constraint
    - Add RLS SELECT policy on `attachments` table for client portal users
      (allows them to view attachments for expenses and quotations on their projects)
    - Add RLS SELECT policy on `storage.objects` for client portal users
      (allows them to read/download attachment files from the private `attachments` bucket)

  2. Security
    - Client portal users can only see attachments whose entity_id belongs to
      a project linked to their customer account. For expenses, the entity_type
      is 'general_expense' or 'site_expense' and entity_id = project_expenses.id.
      For quotations, entity_type = 'vendor_quotation' and entity_id = vendor_quotations.id.
    - Storage access is scoped: the client portal user can read files in the
      `attachments` bucket where the first path segment (organization_id) matches
      their linked organization via client_portal_users.
    - No INSERT/UPDATE/DELETE access for client portal users — read-only.

  3. Notes
    - Idempotent: constraint drop/recreate preserves existing rows.
    - Policies are additive (OR'd with existing org-member policies).
*/

-- 1. Expand entity_type CHECK to include 'vendor_quotation'
ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_entity_type_check;

ALTER TABLE attachments ADD CONSTRAINT attachments_entity_type_check
  CHECK (entity_type IN (
    'general_expense',
    'site_expense',
    'vendor_payment',
    'vendor',
    'employee_advance',
    'project_income',
    'item',
    'vendor_quotation'
  ));

-- 2. RLS: client portal users can SELECT attachments for their projects' expenses and quotations
DROP POLICY IF EXISTS "client_portal_view_attachments" ON attachments;
CREATE POLICY "client_portal_view_attachments"
  ON attachments FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM client_portal_users WHERE user_id = auth.uid() AND is_active = true
    )
    AND (
      -- Expense attachments: entity_id must be a project_expense on one of their projects
      (
        entity_type IN ('general_expense', 'site_expense')
        AND entity_id IN (
          SELECT pe.id FROM project_expenses pe
          WHERE pe.project_id IN (
            SELECT id FROM projects WHERE client_id IN (
              SELECT customer_id FROM client_portal_users WHERE user_id = auth.uid() AND is_active = true
            )
          )
        )
      )
      OR
      -- Quotation attachments: entity_id must be a vendor_quotation on one of their projects
      (
        entity_type = 'vendor_quotation'
        AND entity_id IN (
          SELECT vq.id FROM vendor_quotations vq
          WHERE vq.project_id IN (
            SELECT id FROM projects WHERE client_id IN (
              SELECT customer_id FROM client_portal_users WHERE user_id = auth.uid() AND is_active = true
            )
          )
        )
      )
    )
  );

-- 3. Storage: client portal users can read attachment files in their organization's folder
DROP POLICY IF EXISTS "client_portal_view_attachment_files" ON storage.objects;
CREATE POLICY "client_portal_view_attachment_files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT organization_id FROM client_portal_users WHERE user_id = auth.uid() AND is_active = true
    )
  );
