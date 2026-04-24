CREATE TABLE IF NOT EXISTS agreement_discount_changes (
  id SERIAL PRIMARY KEY,
  agreement_id INTEGER NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL,
  discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  changed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agreement_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_agreement_discount_changes_agreement
  ON agreement_discount_changes(agreement_id, effective_from);

INSERT INTO agreement_discount_changes (agreement_id, effective_from, discount_percentage, changed_by, created_at)
SELECT
  a.id,
  COALESCE(a.impact_starts_at, DATE '2026-03-01'),
  a.discount_percentage,
  a.approved_by,
  COALESCE(a.granted_at, a.created_at)
FROM agreements a
ON CONFLICT (agreement_id, effective_from) DO NOTHING;
