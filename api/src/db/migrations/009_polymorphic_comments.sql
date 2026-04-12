-- Rename agreement_comments to comments and make polymorphic
ALTER TABLE agreement_comments RENAME TO comments;

-- Add polymorphic columns
ALTER TABLE comments ADD COLUMN entity_type VARCHAR(50);
ALTER TABLE comments ADD COLUMN entity_id INTEGER;

-- Migrate existing data: all current rows are agreement comments
UPDATE comments SET entity_type = 'agreement', entity_id = agreement_id;

-- Make columns NOT NULL after migration
ALTER TABLE comments ALTER COLUMN entity_type SET NOT NULL;
ALTER TABLE comments ALTER COLUMN entity_id SET NOT NULL;

-- Drop old FK and column
ALTER TABLE comments DROP CONSTRAINT IF EXISTS agreement_comments_agreement_id_fkey;
ALTER TABLE comments DROP COLUMN agreement_id;

-- Index for efficient lookups
CREATE INDEX idx_comments_entity ON comments (entity_type, entity_id);

-- Check constraint for known entity types
ALTER TABLE comments ADD CONSTRAINT chk_entity_type CHECK (entity_type IN ('family', 'agreement'));
