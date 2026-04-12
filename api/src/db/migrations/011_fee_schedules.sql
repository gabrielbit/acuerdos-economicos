-- Tabla de tarifarios con fecha de vigencia
CREATE TABLE fee_schedules (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  effective_from DATE NOT NULL UNIQUE,
  total_budget NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cuotas por nivel para cada tarifario
CREATE TABLE fee_schedule_rates (
  id SERIAL PRIMARY KEY,
  fee_schedule_id INTEGER NOT NULL REFERENCES fee_schedules(id) ON DELETE CASCADE,
  level education_level NOT NULL,
  tuition_amount NUMERIC(12,2) NOT NULL,
  extras_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  UNIQUE(fee_schedule_id, level)
);

-- Migrar datos existentes: tarifario Marzo 2026
INSERT INTO fee_schedules (name, effective_from, total_budget)
SELECT 'Tarifario Marzo 2026', '2026-03-01', ap.total_budget
FROM aid_periods ap WHERE ap.is_active = true
LIMIT 1;

INSERT INTO fee_schedule_rates (fee_schedule_id, level, tuition_amount, extras_amount)
SELECT fs.id, tr.level, tr.tuition_amount, tr.extras_amount
FROM tuition_rates tr
JOIN aid_periods ap ON ap.id = tr.period_id AND ap.is_active = true
JOIN fee_schedules fs ON fs.effective_from = '2026-03-01';

-- Nuevo tarifario Abril 2026
INSERT INTO fee_schedules (name, effective_from, total_budget)
VALUES ('Tarifario Abril 2026', '2026-04-01', 18358030.80);

INSERT INTO fee_schedule_rates (fee_schedule_id, level, tuition_amount, extras_amount)
SELECT fs.id, level, tuition_amount, extras_amount
FROM fee_schedules fs,
(VALUES
  ('jardin'::education_level, 702000, 0),
  ('primaria'::education_level, 887700, 30300),
  ('secundaria'::education_level, 927000, 40000),
  ('12vo'::education_level, 1112000, 40000)
) AS v(level, tuition_amount, extras_amount)
WHERE fs.effective_from = '2026-04-01';
