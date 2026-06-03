-- Fix missing academic year for school d62a870b-4cc0-44a3-b5fe-636010d8a67d
-- This script creates a current academic year if one doesn't exist

-- First, check if there's already an academic year for this school
SELECT id, name, start_date, end_date, is_current 
FROM academic_years 
WHERE school_id = 'd62a870b-4cc0-44a3-b5fe-636010d8a67d';

-- If no academic year exists, run this INSERT:
INSERT INTO academic_years (
    school_id,
    name,
    start_date,
    end_date,
    is_current
)
SELECT 
    'd62a870b-4cc0-44a3-b5fe-636010d8a67d',
    '2025-2026',
    '2025-04-01',
    '2026-03-31',
    true
WHERE NOT EXISTS (
    SELECT 1 FROM academic_years 
    WHERE school_id = 'd62a870b-4cc0-44a3-b5fe-636010d8a67d'
    AND is_current = true
);

-- If an academic year exists but is not marked as current, run this UPDATE:
UPDATE academic_years 
SET is_current = true
WHERE school_id = 'd62a870b-4cc0-44a3-b5fe-636010d8a67d'
AND id = (
    SELECT id FROM academic_years 
    WHERE school_id = 'd62a870b-4cc0-44a3-b5fe-636010d8a67d'
    ORDER BY start_date DESC
    LIMIT 1
)
AND NOT EXISTS (
    SELECT 1 FROM academic_years 
    WHERE school_id = 'd62a870b-4cc0-44a3-b5fe-636010d8a67d'
    AND is_current = true
);

-- Verify the fix
SELECT id, name, start_date, end_date, is_current 
FROM academic_years 
WHERE school_id = 'd62a870b-4cc0-44a3-b5fe-636010d8a67d';
