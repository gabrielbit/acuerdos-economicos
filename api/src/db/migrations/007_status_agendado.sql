-- Agregar nuevo estado "entrevista_agendada" al enum de agreement_status
ALTER TYPE agreement_status ADD VALUE 'entrevista_agendada' AFTER 'pendiente';
