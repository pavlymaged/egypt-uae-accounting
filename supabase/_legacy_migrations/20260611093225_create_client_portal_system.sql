
-- Client portal users table: links auth users to customers
CREATE TABLE IF NOT EXISTS client_portal_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(customer_id),
  UNIQUE(user_id)
);

ALTER TABLE client_portal_users ENABLE ROW LEVEL SECURITY;

-- Admin policies: org members can manage client portal users
CREATE POLICY "select_client_portal_users" ON client_portal_users FOR SELECT
  TO authenticated USING (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    ) OR user_id = auth.uid()
  );

CREATE POLICY "insert_client_portal_users" ON client_portal_users FOR INSERT
  TO authenticated WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'owner', 'admin')
    )
  );

CREATE POLICY "update_client_portal_users" ON client_portal_users FOR UPDATE
  TO authenticated USING (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'owner', 'admin')
    )
  );

CREATE POLICY "delete_client_portal_users" ON client_portal_users FOR DELETE
  TO authenticated USING (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'owner', 'admin')
    )
  );

-- Additional SELECT policies for client portal users on the relevant tables
-- These work alongside existing policies (PostgreSQL OR's multiple policies)

CREATE POLICY "client_portal_view_own_customer" ON customers FOR SELECT
  TO authenticated USING (
    id IN (SELECT customer_id FROM client_portal_users WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "client_portal_view_projects" ON projects FOR SELECT
  TO authenticated USING (
    client_id IN (SELECT customer_id FROM client_portal_users WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "client_portal_view_income" ON project_income FOR SELECT
  TO authenticated USING (
    project_id IN (
      SELECT id FROM projects WHERE client_id IN (
        SELECT customer_id FROM client_portal_users WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

CREATE POLICY "client_portal_view_expenses" ON project_expenses FOR SELECT
  TO authenticated USING (
    project_id IN (
      SELECT id FROM projects WHERE client_id IN (
        SELECT customer_id FROM client_portal_users WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

CREATE POLICY "client_portal_view_vendor_payments" ON vendor_project_payments FOR SELECT
  TO authenticated USING (
    project_id IN (
      SELECT id FROM projects WHERE client_id IN (
        SELECT customer_id FROM client_portal_users WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

CREATE POLICY "client_portal_view_quotations" ON vendor_quotations FOR SELECT
  TO authenticated USING (
    project_id IN (
      SELECT id FROM projects WHERE client_id IN (
        SELECT customer_id FROM client_portal_users WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

CREATE POLICY "client_portal_approve_quotations" ON vendor_quotations FOR UPDATE
  TO authenticated USING (
    project_id IN (
      SELECT id FROM projects WHERE client_id IN (
        SELECT customer_id FROM client_portal_users WHERE user_id = auth.uid() AND is_active = true
      )
    )
  ) WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE client_id IN (
        SELECT customer_id FROM client_portal_users WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

CREATE POLICY "client_portal_view_quotation_lines" ON quotation_lines FOR SELECT
  TO authenticated USING (
    quotation_id IN (
      SELECT vq.id FROM vendor_quotations vq
      WHERE vq.project_id IN (
        SELECT id FROM projects WHERE client_id IN (
          SELECT customer_id FROM client_portal_users WHERE user_id = auth.uid() AND is_active = true
        )
      )
    )
  );
