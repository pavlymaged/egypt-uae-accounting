
-- Allow client portal users to read attachments for their expenses and quotations
CREATE POLICY "client_portal_view_attachments" ON attachments FOR SELECT
  TO authenticated USING (
    -- For site expenses linked to their projects
    (entity_type = 'site_expense' AND entity_id IN (
      SELECT pe.id FROM project_expenses pe
      WHERE pe.project_id IN (
        SELECT id FROM projects WHERE client_id IN (
          SELECT customer_id FROM client_portal_users WHERE user_id = auth.uid() AND is_active = true
        )
      )
    ))
    OR
    -- For vendor payments linked to their projects
    (entity_type = 'vendor_payment' AND entity_id IN (
      SELECT vpp.id FROM vendor_project_payments vpp
      WHERE vpp.project_id IN (
        SELECT id FROM projects WHERE client_id IN (
          SELECT customer_id FROM client_portal_users WHERE user_id = auth.uid() AND is_active = true
        )
      )
    ))
  );
