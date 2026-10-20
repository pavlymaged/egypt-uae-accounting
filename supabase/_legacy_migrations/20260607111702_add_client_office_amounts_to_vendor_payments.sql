
ALTER TABLE vendor_project_payments
  ADD COLUMN IF NOT EXISTS client_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS office_amount numeric DEFAULT 0;
