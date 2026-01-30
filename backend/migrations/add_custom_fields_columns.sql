-- Add custom_fields JSONB column to entities that need it
-- This allows storing custom field values for students, parents, and teachers

-- Add custom_fields column to parents table
ALTER TABLE parents ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

-- Add custom_fields column to students table (if not exists)
ALTER TABLE students ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

-- Create indexes for better performance on custom_fields queries
CREATE INDEX IF NOT EXISTS idx_parents_custom_fields ON parents USING GIN (custom_fields);
CREATE INDEX IF NOT EXISTS idx_students_custom_fields ON students USING GIN (custom_fields);
CREATE INDEX IF NOT EXISTS idx_staff_custom_fields ON staff USING GIN (custom_fields);

-- Add comments for documentation
COMMENT ON COLUMN parents.custom_fields IS 'JSONB object storing custom field values defined in custom_field_definitions table';
COMMENT ON COLUMN students.custom_fields IS 'JSONB object storing custom field values defined in custom_field_definitions table';
COMMENT ON COLUMN staff.custom_fields IS 'JSONB object storing custom field values defined in custom_field_definitions table';

-- Verify the changes
SELECT 
    table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name IN ('parents', 'students', 'staff')
  AND column_name = 'custom_fields'
ORDER BY table_name;
