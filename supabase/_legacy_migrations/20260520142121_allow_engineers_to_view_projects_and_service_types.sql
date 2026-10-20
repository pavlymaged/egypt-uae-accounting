/*
  # Allow Site Engineers to View Projects and Service Types

  1. Security Changes
    - Add SELECT policy on `projects` for site engineers
      Allows engineers to view projects in their organization
    - Add SELECT policy on `service_types` for site engineers
      Allows engineers to view service types (professions) in their organization

  2. Notes
    - Site engineers do not have entries in `user_roles`, so existing policies
      based on `user_roles` block their access to these tables
    - Engineers need to see projects and professions to submit expenses
    - Access is scoped to the engineer's organization via `site_engineers.organization_id`
*/

CREATE POLICY "Site engineers can view projects in their org"
  ON projects FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT se.organization_id FROM site_engineers se
      WHERE se.user_id = auth.uid() AND se.is_active = true
    )
  );

CREATE POLICY "Site engineers can view service types in their org"
  ON service_types FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT se.organization_id FROM site_engineers se
      WHERE se.user_id = auth.uid() AND se.is_active = true
    )
  );
