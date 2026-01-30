-- =====================================================
-- Diagnostic Query to Debug Fee Generation
-- Run this to see why students aren't getting fees
-- Replace 'YOUR_SCHOOL_ID' with your actual school ID
-- =====================================================

-- Check 1: Is there a current academic year?
SELECT 'Current Academic Year' as check_type, * 
FROM academic_years 
WHERE school_id = 'YOUR_SCHOOL_ID' AND is_current = true;

-- Check 2: Are there active students?
SELECT 'Active Students' as check_type, 
    s.id, s.student_number, s.grade_level_id, 
    p.first_name, p.last_name, p.is_active
FROM students s
JOIN profiles p ON p.id = s.profile_id
WHERE s.school_id = 'YOUR_SCHOOL_ID';

-- Check 3: Are there fee structures with TUITION category?
SELECT 'Fee Structures' as check_type,
    fs.id, fs.academic_year, fs.grade_level_id, 
    gl.name as grade_name, fc.name as category_name, fc.code, fs.amount
FROM fee_structures fs
JOIN fee_categories fc ON fc.id = fs.fee_category_id
LEFT JOIN grade_levels gl ON gl.id = fs.grade_level_id
WHERE fs.school_id = 'YOUR_SCHOOL_ID' 
    AND fs.is_active = true
    AND fc.code = 'TUITION';

-- Check 4: Are there any TUITION fee categories?
SELECT 'Fee Categories' as check_type, * 
FROM fee_categories 
WHERE school_id = 'YOUR_SCHOOL_ID' AND code = 'TUITION';

-- Check 5: Check for existing fees this month
SELECT 'Existing Fees' as check_type, * 
FROM student_fees 
WHERE school_id = 'YOUR_SCHOOL_ID'
    AND fee_month = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

-- Check 6: Full diagnostic - what would the query select?
SELECT 
    s.id as student_id,
    s.student_number,
    s.grade_level_id,
    gl.name as grade_name,
    p.first_name,
    p.last_name,
    p.is_active as profile_active,
    ay.name as academic_year,
    ay.is_current,
    EXISTS(
        SELECT 1 FROM fee_structures fs
        JOIN fee_categories fc ON fc.id = fs.fee_category_id
        WHERE fs.school_id = s.school_id
            AND fs.grade_level_id = s.grade_level_id
            AND fc.code = 'TUITION'
            AND fs.is_active = true
    ) as has_fee_structure
FROM students s
JOIN profiles p ON p.id = s.profile_id
LEFT JOIN grade_levels gl ON gl.id = s.grade_level_id
CROSS JOIN academic_years ay
WHERE s.school_id = 'YOUR_SCHOOL_ID'
    AND ay.school_id = s.school_id
    AND ay.is_current = true
    AND p.is_active = true;
