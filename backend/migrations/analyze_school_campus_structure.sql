-- Deep analysis of the school/campus structure and academic years issue

-- 1. Show all schools with their parent relationship
SELECT 
    id,
    name,
    parent_school_id,
    CASE 
        WHEN parent_school_id IS NULL THEN '🏢 PARENT SCHOOL'
        ELSE '🏫 CAMPUS (Child)'
    END as school_type,
    created_at
FROM schools
ORDER BY parent_school_id NULLS FIRST, name;

-- 2. Show where academic years are stored
SELECT 
    ay.id,
    ay.name as academic_year_name,
    ay.is_current,
    ay.school_id,
    s.name as school_name,
    s.parent_school_id,
    CASE 
        WHEN s.parent_school_id IS NULL THEN '🏢 Stored in PARENT SCHOOL'
        ELSE '🏫 Stored in CAMPUS (Wrong!)'
    END as storage_location
FROM academic_years ay
JOIN schools s ON s.id = ay.school_id
ORDER BY ay.created_at DESC;

-- 3. Show where librarians are assigned
SELECT 
    p.email,
    p.role,
    st.school_id,
    s.name as assigned_school_name,
    s.parent_school_id,
    CASE 
        WHEN s.parent_school_id IS NULL THEN '🏢 Assigned to PARENT SCHOOL (Correct)'
        ELSE '🏫 Assigned to CAMPUS (Wrong for shared resources!)'
    END as assignment_type,
    st.employee_number
FROM profiles p
JOIN staff st ON st.profile_id = p.id
JOIN schools s ON s.id = st.school_id
WHERE p.role = 'librarian'
ORDER BY s.parent_school_id NULLS FIRST;

-- 4. Show the problem: Academic years vs Librarian school_id mismatch
SELECT 
    'Academic Years are in:' as issue,
    s.name as school_name,
    s.id as school_id,
    CASE WHEN s.parent_school_id IS NULL THEN 'PARENT' ELSE 'CAMPUS' END as type
FROM academic_years ay
JOIN schools s ON s.id = ay.school_id
LIMIT 1

UNION ALL

SELECT 
    'Librarians are in:' as issue,
    s.name as school_name,
    s.id as school_id,
    CASE WHEN s.parent_school_id IS NULL THEN 'PARENT' ELSE 'CAMPUS' END as type
FROM profiles p
JOIN staff st ON st.profile_id = p.id
JOIN schools s ON s.id = st.school_id
WHERE p.role = 'librarian';
