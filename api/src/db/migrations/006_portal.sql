-- Tabla de relación familia-usuario (soporta múltiples usuarios por familia)
CREATE TABLE IF NOT EXISTS family_users (
  id SERIAL PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(family_id, user_id)
);

-- Migrar datos existentes
INSERT INTO family_users (family_id, user_id)
  SELECT id, user_id FROM families WHERE user_id IS NOT NULL
  ON CONFLICT DO NOTHING;

-- Invitaciones: máximo 2 usos
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS max_uses INTEGER NOT NULL DEFAULT 2;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS use_count INTEGER NOT NULL DEFAULT 0;

-- Solicitudes: quién llenó y snapshot inmutable
ALTER TABLE aid_requests ADD COLUMN IF NOT EXISTS submitted_by INTEGER REFERENCES users(id);
ALTER TABLE aid_requests ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE aid_requests ADD COLUMN IF NOT EXISTS form_snapshot JSONB;

CREATE INDEX IF NOT EXISTS idx_family_users_family ON family_users(family_id);
CREATE INDEX IF NOT EXISTS idx_family_users_user ON family_users(user_id);
