-- Debug student campus assignments
-- Check which school_id (campus) each student belongs to

SELECT 
    s.id,
    s.student_number,
    s.school_id as student_school_id,
    p.first_name,
    p.last_name,
    p.school_id as profile_school_id,
    -- Check if school_id matches any campus
    CASE 
        WHEN s.school_id = '56e6c22c-fe64-456f-9b6c-88f2e58af8ae' THEN 'Downtown Campus'
        WHEN s.school_id = '1331cdd8-59ee-4ce8-a1c3-98c9e7ecfa23' THEN 'Prime Stars Campus'
        WHEN s.school_id = 'fb9eeb8f-1e6f-46eb-8f5b-95b9df3a1d7e' THEN 'Parent School (NOT CAMPUS)'
        ELSE 'Unknown/Other'
    END as campus_assignment
FROM students s
LEFT JOIN profiles p ON s.profile_id = p.id
ORDER BY s.created_at DESC;

-- Show all schools/campuses
SELECT 
    id,
    name,
    parent_school_id,
    CASE 
        WHEN parent_school_id IS NULL THEN 'PARENT SCHOOL'
        ELSE 'CAMPUS'
    END as type
FROM schools
ORDER BY parent_school_id NULLS FIRST, name;

-- Check if students are assigned to parent school instead of campus
SELECT 
    COUNT(*) as total_students,
    COUNT(CASE WHEN s.school_id IN (
        SELECT id FROM schools WHERE parent_school_id IS NULL
    ) THEN 1 END) as assigned_to_parent_school,
    COUNT(CASE WHEN s.school_id IN (
        SELECT id FROM schools WHERE parent_school_id IS NOT NULL
    ) THEN 1 END) as assigned_to_campus
FROM students s;
