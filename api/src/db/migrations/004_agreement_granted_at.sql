ALTER TABLE agreements ADD COLUMN IF NOT EXISTS granted_at TIMESTAMPTZ;
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;

-- Setear granted_at para los acuerdos ya otorgados
UPDATE agreements SET granted_at = created_at, status_changed_at = created_at WHERE status = 'asignado';
UPDATE agreements SET status_changed_at = created_at WHERE status != 'asignado';
