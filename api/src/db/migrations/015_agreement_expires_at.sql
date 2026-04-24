ALTER TABLE agreements
  ADD COLUMN IF NOT EXISTS expires_at DATE;

UPDATE agreements
SET expires_at = DATE '2026-08-31'
WHERE expires_at IS NULL;
