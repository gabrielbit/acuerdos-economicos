-- Campos adicionales en families para datos de contacto completos
ALTER TABLE families ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE families ADD COLUMN IF NOT EXISTS locality VARCHAR(100);
ALTER TABLE families ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10);

-- Datos del grupo familiar (adultos)
CREATE TABLE family_members (
  id SERIAL PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  relationship VARCHAR(50) NOT NULL, -- papa, mama, tutor, etc.
  occupation VARCHAR(255),
  age INTEGER,
  observations TEXT
);

-- Ampliar students para incluir hijos en otras escuelas
ALTER TABLE students ADD COLUMN IF NOT EXISTS school VARCHAR(255);
ALTER TABLE students ADD COLUMN IF NOT EXISTS requests_aid BOOLEAN DEFAULT false;
ALTER TABLE students ADD COLUMN IF NOT EXISTS has_current_aid BOOLEAN DEFAULT false;

-- Datos de vivienda para la solicitud
CREATE TYPE housing_type AS ENUM ('vivienda', 'duplex', 'chalet', 'casa', 'departamento', 'ph');

-- Ampliar aid_requests con los datos del formulario real
ALTER TABLE aid_requests ADD COLUMN IF NOT EXISTS is_renewal BOOLEAN DEFAULT false;
ALTER TABLE aid_requests ADD COLUMN IF NOT EXISTS housing_type housing_type;
ALTER TABLE aid_requests ADD COLUMN IF NOT EXISTS housing_surface VARCHAR(20);
ALTER TABLE aid_requests ADD COLUMN IF NOT EXISTS housing_rooms INTEGER;
ALTER TABLE aid_requests ADD COLUMN IF NOT EXISTS housing_bedrooms INTEGER;
ALTER TABLE aid_requests ADD COLUMN IF NOT EXISTS additional_info JSONB;

CREATE INDEX idx_family_members_family ON family_members(family_id);
