-- Migration: Optimize Parent-Student Association System
-- Date: 2026-01-13
-- Description: Add constraints and relation types for strict parent-student linking

-- First, let's check the current structure and add a relation_type column if needed
-- The relationship column should be standardized to specific values

-- Add relation_type enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE parent_relation_type AS ENUM ('father', 'mother', 'both', 'guardian', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add new columns to parent_student_links if they don't exist
ALTER TABLE parent_student_links
ADD COLUMN IF NOT EXISTS relation_type parent_relation_type,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Migrate existing 'relationship' data to 'relation_type' (if relation_type is null)
UPDATE parent_student_links
SET relation_type = 
  CASE 
    WHEN LOWER(relationship) IN ('father', 'dad', 'father/guardian') THEN 'father'::parent_relation_type
    WHEN LOWER(relationship) IN ('mother', 'mom', 'mother/guardian') THEN 'mother'::parent_relation_type
    WHEN LOWER(relationship) IN ('both', 'both parents', 'parents') THEN 'both'::parent_relation_type
    WHEN LOWER(relationship) IN ('guardian', 'legal guardian') THEN 'guardian'::parent_relation_type
    ELSE 'other'::parent_relation_type
  END
WHERE relation_type IS NULL;

-- Create composite unique constraint: A student can only have ONE active link per relation_type
-- This prevents having two fathers, two mothers, etc.
DROP INDEX IF EXISTS unique_student_active_relation;
CREATE UNIQUE INDEX unique_student_active_relation 
ON parent_student_links(student_id, relation_type) 
WHERE is_active = true;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_parent_student_links_student ON parent_student_links(student_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_links_parent ON parent_student_links(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_links_relation ON parent_student_links(relation_type);
CREATE INDEX IF NOT EXISTS idx_parent_student_links_active ON parent_student_links(is_active) WHERE is_active = true;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_parent_student_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS parent_student_links_updated_at_trigger ON parent_student_links;
CREATE TRIGGER parent_student_links_updated_at_trigger
  BEFORE UPDATE ON parent_student_links
  FOR EACH ROW
  EXECUTE FUNCTION update_parent_student_links_updated_at();

-- Add validation function to enforce business rules
CREATE OR REPLACE FUNCTION validate_parent_student_link()
RETURNS TRIGGER AS $$
DECLARE
  existing_father BOOLEAN;
  existing_mother BOOLEAN;
  existing_both BOOLEAN;
BEGIN
  -- Only validate for active links
  IF NEW.is_active = false THEN
    RETURN NEW;
  END IF;

  -- Check existing active relations for this student
  SELECT EXISTS(
    SELECT 1 FROM parent_student_links 
    WHERE student_id = NEW.student_id 
    AND relation_type = 'father'::parent_relation_type 
    AND is_active = true
    AND parent_id != NEW.parent_id  -- Exclude current parent if updating
  ) INTO existing_father;

  SELECT EXISTS(
    SELECT 1 FROM parent_student_links 
    WHERE student_id = NEW.student_id 
    AND relation_type = 'mother'::parent_relation_type 
    AND is_active = true
    AND parent_id != NEW.parent_id
  ) INTO existing_mother;

  SELECT EXISTS(
    SELECT 1 FROM parent_student_links 
    WHERE student_id = NEW.student_id 
    AND relation_type = 'both'::parent_relation_type 
    AND is_active = true
    AND parent_id != NEW.parent_id
  ) INTO existing_both;

  -- Enforce exclusivity rules
  IF NEW.relation_type = 'father' THEN
    IF existing_father THEN
      RAISE EXCEPTION 'Exclusivity Policy: Student already has an active Father. Remove existing Father first.';
    END IF;
    IF existing_both THEN
      RAISE EXCEPTION 'Joint Entity Policy: Student has joint guardianship (Both). Cannot add individual Father role.';
    END IF;
  ELSIF NEW.relation_type = 'mother' THEN
    IF existing_mother THEN
      RAISE EXCEPTION 'Exclusivity Policy: Student already has an active Mother. Remove existing Mother first.';
    END IF;
    IF existing_both THEN
      RAISE EXCEPTION 'Joint Entity Policy: Student has joint guardianship (Both). Cannot add individual Mother role.';
    END IF;
  ELSIF NEW.relation_type = 'both' THEN
    IF existing_father OR existing_mother OR existing_both THEN
      RAISE EXCEPTION 'Joint Entity Policy: Cannot assign joint guardianship (Both) when individual Father/Mother roles exist. Remove existing relations first.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_parent_student_link_trigger ON parent_student_links;
CREATE TRIGGER validate_parent_student_link_trigger
  BEFORE INSERT OR UPDATE ON parent_student_links
  FOR EACH ROW
  EXECUTE FUNCTION validate_parent_student_link();

-- Add comments for documentation
COMMENT ON TABLE parent_student_links IS 'Central global association system for parent-student relationships with strict exclusivity rules';
COMMENT ON COLUMN parent_student_links.relation_type IS 'Type of relationship: father, mother, both (joint guardianship), guardian, or other';
COMMENT ON COLUMN parent_student_links.is_active IS 'Whether this link is currently active. Use for archiving instead of deleting.';
COMMENT ON COLUMN parent_student_links.relationship IS 'Legacy field for custom relationship description';
COMMENT ON INDEX unique_student_active_relation IS 'Ensures a student can only have ONE active link per relation type (prevents duplicate fathers/mothers)';

-- Add helpful view for active parent-student relationships
CREATE OR REPLACE VIEW active_parent_student_links AS
SELECT 
  psl.*,
  p.profile_id as parent_profile_id,
  pp.first_name as parent_first_name,
  pp.last_name as parent_last_name,
  pp.email as parent_email,
  s.profile_id as student_profile_id,
  sp.first_name as student_first_name,
  sp.last_name as student_last_name,
  s.student_number,
  s.grade_level
FROM parent_student_links psl
JOIN parents p ON psl.parent_id = p.id
JOIN profiles pp ON p.profile_id = pp.id
JOIN students s ON psl.student_id = s.id
JOIN profiles sp ON s.profile_id = sp.id
WHERE psl.is_active = true;

COMMENT ON VIEW active_parent_student_links IS 'Convenient view showing all active parent-student relationships with profile details';
