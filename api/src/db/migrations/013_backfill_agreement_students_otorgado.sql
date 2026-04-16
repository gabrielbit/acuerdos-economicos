-- Repone filas en agreement_students para familias en otorgado cuando faltaba
-- el detalle por hijo (datos viejos o creación incompleta). Usa el tarifario
-- vigente a la fecha de ejecución y el % de descuento del acuerdo activo.

WITH active_period AS (
  SELECT id FROM aid_periods WHERE is_active = true LIMIT 1
),
latest_fs AS (
  SELECT id FROM fee_schedules
  WHERE effective_from <= CURRENT_DATE
  ORDER BY effective_from DESC
  LIMIT 1
),
missing AS (
  SELECT
    a.id AS agreement_id,
    s.id AS student_id,
    s.level,
    a.discount_percentage,
    fsr.tuition_amount,
    fsr.extras_amount
  FROM families f
  CROSS JOIN active_period ap
  JOIN agreements a ON a.family_id = f.id AND a.period_id = ap.id
  JOIN students s ON s.family_id = f.id
  CROSS JOIN latest_fs l
  JOIN fee_schedule_rates fsr ON fsr.fee_schedule_id = l.id AND fsr.level = s.level
  LEFT JOIN agreement_students ast ON ast.agreement_id = a.id AND ast.student_id = s.id
  WHERE f.status::text = 'otorgado'
    AND ast.id IS NULL
)
INSERT INTO agreement_students (
  agreement_id,
  student_id,
  level,
  base_tuition,
  extras,
  discount_percentage,
  discount_amount,
  amount_to_pay
)
SELECT
  agreement_id,
  student_id,
  level,
  tuition_amount,
  extras_amount,
  discount_percentage,
  ROUND((tuition_amount * discount_percentage / 100)::numeric, 2),
  ROUND((tuition_amount - tuition_amount * discount_percentage / 100 + extras_amount)::numeric, 2)
FROM missing;
