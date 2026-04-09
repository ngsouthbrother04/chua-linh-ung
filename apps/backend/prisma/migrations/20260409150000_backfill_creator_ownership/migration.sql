INSERT INTO users (
  id,
  email,
  password_hash,
  full_name,
  role,
  preferred_language,
  is_active,
  created_at,
  updated_at
)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'partner@phoamthuc.local',
  '$2b$10$zRgY6SnK8/krYQ6AgPG3X.QAXvSa89WnmW5.Ar/8V20BpMVpJl3V2',
  'Food Partner',
  'PARTNER',
  'vi',
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (email)
DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  preferred_language = EXCLUDED.preferred_language,
  is_active = EXCLUDED.is_active,
  updated_at = CURRENT_TIMESTAMP;

WITH partner_owner AS (
  SELECT id
  FROM users
  WHERE email = 'partner@phoamthuc.local'
  ORDER BY created_at ASC
  LIMIT 1
)
UPDATE points_of_interest poi
SET creator_id = partner_owner.id
FROM partner_owner
WHERE poi.creator_id IS NULL;

WITH partner_owner AS (
  SELECT id
  FROM users
  WHERE email = 'partner@phoamthuc.local'
  ORDER BY created_at ASC
  LIMIT 1
)
UPDATE tours tour
SET creator_id = partner_owner.id
FROM partner_owner
WHERE tour.creator_id IS NULL;
