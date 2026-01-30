-- Check exact campus IDs in schools table vs what students have
SELECT 
    'SCHOOLS TABLE' as source,
    id,
    name,
    parent_school_id,
    CASE 
        WHEN parent_school_id IS NULL THEN 'PARENT'
        ELSE 'CAMPUS'
    END as type
FROM schools
WHERE name IN ('Bay Area', 'Prime Stars', 'Springerfeild')
ORDER BY parent_school_id NULLS FIRST, name;

-- Compare with student school_ids
SELECT DISTINCT
    'STUDENTS TABLE' as source,
    s.school_id as id,
    sch.name,
    sch.parent_school_id
FROM students s
LEFT JOIN schools sch ON s.school_id = sch.id
ORDER BY sch.name;

-- Check if the Bay Area campus ID matches between tables
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM schools 
            WHERE id = 'd62a870b-4cc0-44a3-b5fe-636010d8a67d' 
            AND name = 'Bay Area'
        ) THEN '✅ Bay Area campus ID matches'
        ELSE '❌ Bay Area campus ID MISMATCH - Frontend has different ID!'
    END as bay_area_check;

-- Show ALL campuses with their exact IDs
SELECT 
    id as campus_id,
    name as campus_name,
    parent_school_id,
    (SELECT COUNT(*) FROM students WHERE school_id = schools.id) as student_count
FROM schools
WHERE parent_school_id IS NOT NULL
ORDER BY name;
