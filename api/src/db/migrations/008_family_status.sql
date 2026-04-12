-- Nuevo enum para status de proceso de familia
CREATE TYPE family_status AS ENUM (
  'solicitud',
  'formulario_enviado',
  'formulario_completado',
  'agendado',
  'en_definicion',
  'otorgado',
  'rechazado',
  'suspendido'
);

-- Agregar columna status a families
ALTER TABLE families ADD COLUMN status family_status NOT NULL DEFAULT 'solicitud';

-- Migrar familias existentes según el status de su acuerdo
UPDATE families f SET status = 'otorgado'
FROM agreements a WHERE a.family_id = f.id AND a.status::text = 'asignado';

UPDATE families f SET status = 'en_definicion'
FROM agreements a WHERE a.family_id = f.id AND a.status::text = 'en_definicion';

UPDATE families f SET status = 'agendado'
FROM agreements a WHERE a.family_id = f.id AND a.status::text = 'entrevista_agendada';

UPDATE families f SET status = 'rechazado'
FROM agreements a WHERE a.family_id = f.id AND a.status::text = 'rechazado';

UPDATE families f SET status = 'suspendido'
FROM agreements a WHERE a.family_id = f.id AND a.status::text = 'suspendido';

-- Eliminar acuerdos placeholder (0% sin decisión real)
DELETE FROM agreements WHERE discount_percentage = 0 AND status::text IN ('pendiente', 'entrevista_agendada');
