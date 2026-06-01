-- Migration: Add additional fields to parents table
-- Date: 2026-01-12
-- Description: Add workplace, income, CNIC, address, emergency contact, preferences, and notes fields

-- Add new columns to parents table
ALTER TABLE parents
ADD COLUMN IF NOT EXISTS workplace TEXT,
ADD COLUMN IF NOT EXISTS income TEXT,
ADD COLUMN IF NOT EXISTS cnic TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_relation TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index on commonly searched fields
CREATE INDEX IF NOT EXISTS idx_parents_cnic ON parents(cnic);
CREATE INDEX IF NOT EXISTS idx_parents_city ON parents(city);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_parents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS parents_updated_at_trigger ON parents;
CREATE TRIGGER parents_updated_at_trigger
  BEFORE UPDATE ON parents
  FOR EACH ROW
  EXECUTE FUNCTION update_parents_updated_at();

-- Add comments for documentation
COMMENT ON COLUMN parents.workplace IS 'Parent''s place of employment';
COMMENT ON COLUMN parents.income IS 'Parent''s monthly income';
COMMENT ON COLUMN parents.cnic IS 'National identity card number';
COMMENT ON COLUMN parents.address IS 'Street address';
COMMENT ON COLUMN parents.city IS 'City name';
COMMENT ON COLUMN parents.state IS 'State or province';
COMMENT ON COLUMN parents.zip_code IS 'Postal/ZIP code';
COMMENT ON COLUMN parents.country IS 'Country name';
COMMENT ON COLUMN parents.emergency_contact_name IS 'Emergency contact person name';
COMMENT ON COLUMN parents.emergency_contact_relation IS 'Relationship to emergency contact';
COMMENT ON COLUMN parents.emergency_contact_phone IS 'Emergency contact phone number';
COMMENT ON COLUMN parents.notes IS 'Additional notes about the parent';
COMMENT ON COLUMN parents.metadata IS 'Flexible JSON field for additional custom fields';
