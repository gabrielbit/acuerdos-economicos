UPDATE comments c
SET
  entity_type = 'family',
  entity_id = a.family_id
FROM agreements a
WHERE c.entity_type = 'agreement'
  AND c.entity_id = a.id;
