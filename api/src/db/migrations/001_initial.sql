-- Tipos enum
CREATE TYPE user_role AS ENUM ('committee', 'family');
CREATE TYPE agreement_status AS ENUM ('pendiente', 'en_definicion', 'asignado', 'rechazado', 'suspendido');
CREATE TYPE education_level AS ENUM ('jardin', 'primaria', 'secundaria', '12vo');
CREATE TYPE request_status AS ENUM ('borrador', 'enviada', 'en_revision', 'resuelta');

-- Usuarios (comisión + familias)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'family',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Familias
CREATE TABLE families (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  parent_names VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Estudiantes (hijos)
CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  level education_level NOT NULL,
  grade VARCHAR(50) NOT NULL,
  file_number VARCHAR(50)
);

-- Períodos de ayuda (Mar-Ago, Sep-Feb)
CREATE TABLE aid_periods (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  start_month INTEGER NOT NULL CHECK (start_month BETWEEN 1 AND 12),
  end_month INTEGER NOT NULL CHECK (end_month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  total_budget NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cuotas por nivel educativo por período
CREATE TABLE tuition_rates (
  id SERIAL PRIMARY KEY,
  period_id INTEGER NOT NULL REFERENCES aid_periods(id) ON DELETE CASCADE,
  level education_level NOT NULL,
  tuition_amount NUMERIC(12,2) NOT NULL,
  extras_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  UNIQUE (period_id, level)
);

-- Acuerdos económicos (uno por familia por período)
CREATE TABLE agreements (
  id SERIAL PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  period_id INTEGER NOT NULL REFERENCES aid_periods(id) ON DELETE CASCADE,
  status agreement_status NOT NULL DEFAULT 'pendiente',
  discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  observations TEXT,
  approved_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_id, period_id)
);

-- Detalle por hijo dentro de un acuerdo
CREATE TABLE agreement_students (
  id SERIAL PRIMARY KEY,
  agreement_id INTEGER NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  level education_level NOT NULL,
  base_tuition NUMERIC(12,2) NOT NULL,
  extras NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_to_pay NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- Solicitudes de ayuda de familias
CREATE TABLE aid_requests (
  id SERIAL PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  period_id INTEGER NOT NULL REFERENCES aid_periods(id) ON DELETE CASCADE,
  status request_status NOT NULL DEFAULT 'borrador',
  requested_discount NUMERIC(5,2),
  reason TEXT,
  review_notes TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invitaciones para familias
CREATE TABLE invitations (
  id SERIAL PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log de acuerdos
CREATE TABLE agreement_audit_log (
  id SERIAL PRIMARY KEY,
  agreement_id INTEGER NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices útiles
CREATE INDEX idx_students_family ON students(family_id);
CREATE INDEX idx_agreements_family ON agreements(family_id);
CREATE INDEX idx_agreements_period ON agreements(period_id);
CREATE INDEX idx_agreements_status ON agreements(status);
CREATE INDEX idx_agreement_students_agreement ON agreement_students(agreement_id);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_audit_agreement ON agreement_audit_log(agreement_id);
