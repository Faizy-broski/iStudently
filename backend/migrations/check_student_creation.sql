-- ============================================================================
-- STUDENT CREATION DIAGNOSTIC SCRIPT
-- Check what school_id students are being assigned and verify campus relationships
-- ============================================================================

-- 1. Show all schools/campuses with their relationships
SELECT 
    id,
    name,
    parent_school_id,
    CASE 
        WHEN parent_school_id IS NULL THEN '🏢 PARENT SCHOOL'
        ELSE '🏫 CAMPUS'
    END as school_type,
    created_at
FROM schools
ORDER BY parent_school_id NULLS FIRST, name;

-- 2. Check which school_id each student has
SELECT 
    s.id as student_id,
    s.student_number,
    s.school_id as student_school_id,
    sch.name as school_name,
    sch.parent_school_id,
    CASE 
        WHEN sch.parent_school_id IS NULL THEN '❌ ASSIGNED TO PARENT SCHOOL (WRONG!)'
        ELSE '✅ ASSIGNED TO CAMPUS (CORRECT)'
    END as assignment_status,
    p.first_name,
    p.last_name,
    p.email,
    s.created_at as student_created_at
FROM students s
LEFT JOIN schools sch ON s.school_id = sch.id
LEFT JOIN profiles p ON s.profile_id = p.id
ORDER BY s.created_at DESC;

-- 3. Count students by school_id
SELECT 
    sch.name as school_name,
    sch.id as school_id,
    CASE 
        WHEN sch.parent_school_id IS NULL THEN 'PARENT SCHOOL'
        ELSE 'CAMPUS'
    END as type,
    COUNT(s.id) as student_count
FROM schools sch
LEFT JOIN students s ON s.school_id = sch.id
GROUP BY sch.id, sch.name, sch.parent_school_id
ORDER BY sch.parent_school_id NULLS FIRST, sch.name;

-- 4. Check if any students have NULL school_id
SELECT 
    COUNT(*) as students_with_null_school_id,
    COUNT(CASE WHEN school_id IS NULL THEN 1 END) as null_count
FROM students;

-- 5. Show the most recently created student with full details
SELECT 
    s.*,
    sch.name as school_name,
    sch.parent_school_id,
    p.first_name,
    p.last_name,
    p.email,
    p.school_id as profile_school_id
FROM students s
LEFT JOIN schools sch ON s.school_id = sch.id
LEFT JOIN profiles p ON s.profile_id = p.id
ORDER BY s.created_at DESC
LIMIT 1;

-- 6. Check if profiles have matching school_id
SELECT 
    s.student_number,
    s.school_id as student_school_id,
    p.school_id as profile_school_id,
    CASE 
        WHEN s.school_id = p.school_id THEN '✅ MATCH'
        ELSE '❌ MISMATCH'
    END as school_id_match,
    p.first_name,
    p.last_name
FROM students s
LEFT JOIN profiles p ON s.profile_id = p.id
ORDER BY s.created_at DESC
LIMIT 10;

-- 7. Show which admin created students (if audit trail exists)
SELECT 
    s.student_number,
    s.school_id as student_school_id,
    sch.name as assigned_to_school,
    s.created_at,
    p.first_name || ' ' || p.last_name as student_name
FROM students s
LEFT JOIN schools sch ON s.school_id = sch.id
LEFT JOIN profiles p ON s.profile_id = p.id
ORDER BY s.created_at DESC
LIMIT 5;
