-- Tipo de entidad: familia o docente
CREATE TYPE family_type AS ENUM ('familia', 'docente');

ALTER TABLE families
  ADD COLUMN family_type family_type NOT NULL DEFAULT 'familia';

CREATE INDEX idx_families_type ON families(family_type);
