ALTER TABLE users ADD COLUMN IF NOT EXISTS can_manage_families BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_manage_agreements BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_change_status BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_manage_users BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_comment BOOLEAN NOT NULL DEFAULT true;

-- El admin existente puede administrar usuarios
UPDATE users SET can_manage_users = true WHERE email = 'admin@colegio.com';
