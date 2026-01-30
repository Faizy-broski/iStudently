-- Fix Custom Fields Sort Order
-- This migration updates sort_order values for custom fields to use sequential numbering
-- Custom fields will be numbered 1, 2, 3, 4... within each entity_type and category

-- Assign sequential sort_order to all custom fields
-- Grouped by entity_type and category_id, ordered by current sort_order then created_at
WITH numbered_fields AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (
            PARTITION BY entity_type, category_id 
            ORDER BY sort_order ASC, created_at ASC
        ) as new_sort_order
    FROM custom_field_definitions
    WHERE is_active = true
)
UPDATE custom_field_definitions cf
SET sort_order = nf.new_sort_order,
    updated_at = NOW()
FROM numbered_fields nf
WHERE cf.id = nf.id;

-- Verify the changes
SELECT 
    entity_type,
    category_id,
    field_key,
    label,
    sort_order,
    is_active,
    created_at
FROM custom_field_definitions
ORDER BY entity_type, category_id, sort_order;

-- Show summary by category
SELECT 
    entity_type,
    category_id,
    COUNT(*) as field_count,
    MIN(sort_order) as min_order,
    MAX(sort_order) as max_order
FROM custom_field_definitions
WHERE is_active = true
GROUP BY entity_type, category_id
ORDER BY entity_type, category_id;
