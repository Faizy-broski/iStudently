-- Add category_order to custom_field_definitions
-- This allows persisting the drag-and-drop order of categories

-- Add the column
ALTER TABLE public.custom_field_definitions 
ADD COLUMN IF NOT EXISTS category_order INTEGER DEFAULT 0;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_custom_fields_category_order 
ON public.custom_field_definitions(category_order);

-- Set initial values based on standard category order
UPDATE public.custom_field_definitions
SET category_order = 
  CASE category_id
    -- Students
    WHEN 'personal' THEN 1
    WHEN 'academic' THEN 2
    WHEN 'medical' THEN 3
    WHEN 'family' THEN 4
    -- Teachers
    WHEN 'professional' THEN 2
    WHEN 'qualifications' THEN 3
    WHEN 'employment' THEN 4
    -- Parents
    WHEN 'contact' THEN 3
    WHEN 'emergency' THEN 4
    -- Common
    WHEN 'system' THEN 5
    ELSE 99
  END
WHERE category_order = 0;

-- Comment
COMMENT ON COLUMN public.custom_field_definitions.category_order IS 
  'Display order of categories in forms (lower numbers appear first)';

-- Verify
SELECT 
  entity_type, 
  category_id, 
  category_name, 
  category_order,
  COUNT(*) as field_count
FROM public.custom_field_definitions
WHERE is_active = true
GROUP BY entity_type, category_id, category_name, category_order
ORDER BY entity_type, category_order, category_id;
