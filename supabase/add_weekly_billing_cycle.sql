-- Add weekly billing cycle support to client_rates
-- Run this in the Supabase SQL editor before deploying the UI changes.
--
-- billing_cycle: 'monthly' (default, existing behavior) or 'weekly'
-- billing_weekday: 0=Sunday, 1=Monday, ..., 6=Saturday (used when billing_cycle = 'weekly')

ALTER TABLE client_rates
  ADD COLUMN IF NOT EXISTS billing_cycle text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS billing_weekday integer;
