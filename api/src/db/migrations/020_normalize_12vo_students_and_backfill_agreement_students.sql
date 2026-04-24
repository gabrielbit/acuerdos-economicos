UPDATE students
SET level = 'secundaria'
WHERE level = '12vo';

UPDATE agreement_students
SET level = 'secundaria'
WHERE level = '12vo';

WITH active_schedule AS (
  SELECT fs.id
  FROM fee_schedules fs
  WHERE fs.effective_from <= CURRENT_DATE
  ORDER BY fs.effective_from DESC
  LIMIT 1
),
active_rate AS (
  SELECT fsr.level, fsr.tuition_amount, fsr.extras_amount
  FROM fee_schedule_rates fsr
  JOIN active_schedule acs ON acs.id = fsr.fee_schedule_id
),
active_period AS (
  SELECT id FROM aid_periods WHERE is_active = true LIMIT 1
)
INSERT INTO agreement_students
  (agreement_id, student_id, level, base_tuition, extras, discount_percentage, discount_amount, amount_to_pay)
SELECT
  a.id,
  s.id,
  s.level,
  ar.tuition_amount,
  ar.extras_amount,
  a.discount_percentage,
  ROUND((ar.tuition_amount * a.discount_percentage / 100.0)::numeric, 2),
  ROUND((ar.tuition_amount - (ar.tuition_amount * a.discount_percentage / 100.0) + ar.extras_amount)::numeric, 2)
FROM agreements a
JOIN active_period ap ON ap.id = a.period_id
JOIN students s ON s.family_id = a.family_id
JOIN active_rate ar ON ar.level = CASE WHEN s.grade = '12vo' THEN '12vo'::education_level ELSE s.level END
WHERE NOT EXISTS (
  SELECT 1
  FROM agreement_students ast
  WHERE ast.agreement_id = a.id
    AND ast.student_id = s.id
);
