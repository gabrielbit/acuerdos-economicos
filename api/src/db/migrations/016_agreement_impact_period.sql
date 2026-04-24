ALTER TABLE agreements
  ADD COLUMN IF NOT EXISTS impact_starts_at DATE;

UPDATE agreements
SET
  impact_starts_at = DATE '2026-02-01',
  expires_at = DATE '2026-08-31';
