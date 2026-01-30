-- =====================================================
-- Step-by-step debug of fee generation
-- Replace YOUR_SCHOOL_ID with your actual school ID
-- =====================================================

-- Step 1: Check academic year
SELECT 'Academic Year' as step, name, is_current
FROM academic_years 
WHERE school_id = 'fb9eeb8f-8d32-4b0b-b502-1602106ac1d6' AND is_current = true;

-- Step 2: Check students being selected
SELECT 
    'Students Query' as step,
    s.id as student_id, 
    s.student_number,
    s.grade_level_id,
    p.is_active as profile_active,
    (
        SELECT COUNT(*) FROM parent_student_links psl1
        WHERE psl1.parent_id IN (
            SELECT parent_id FROM parent_student_links 
            WHERE student_id = s.id AND is_active = true
        )
        AND psl1.is_active = true
    ) as sibling_count
FROM students s
JOIN profiles p ON p.id = s.profile_id
WHERE s.school_id = 'fb9eeb8f-8d32-4b0b-b502-1602106ac1d6'
  AND p.is_active = true;

-- Step 3: Check fee structures being found
WITH student_data AS (
    SELECT 
        s.id as student_id,
        s.grade_level_id
    FROM students s
    JOIN profiles p ON p.id = s.profile_id
    WHERE s.school_id = 'fb9eeb8f-8d32-4b0b-b502-1602106ac1d6'
      AND p.is_active = true
    LIMIT 1
),
academic_year_data AS (
    SELECT name as academic_year
    FROM academic_years 
    WHERE school_id = 'fb9eeb8f-8d32-4b0b-b502-1602106ac1d6' 
      AND is_current = true
)
SELECT 
    'Fee Structure Query' as step,
    fs.id as fee_structure_id,
    fs.amount,
    fs.academic_year,
    fs.grade_level_id,
    fc.code as category_code,
    fc.name as category_name,
    CASE 
        WHEN fc.code = 'TUITION' THEN 1
        WHEN fc.code LIKE 'TF-%' THEN 2
        ELSE 3
    END as priority
FROM fee_structures fs
JOIN fee_categories fc ON fc.id = fs.fee_category_id
CROSS JOIN student_data sd
CROSS JOIN academic_year_data ay
WHERE fs.school_id = 'fb9eeb8f-8d32-4b0b-b502-1602106ac1d6'
  AND fs.grade_level_id = sd.grade_level_id
  AND fs.academic_year = ay.academic_year
  AND fs.is_active = true
ORDER BY 
  CASE 
    WHEN fc.code = 'TUITION' THEN 1
    WHEN fc.code LIKE 'TF-%' THEN 2
    ELSE 3
  END,
  fs.created_at ASC;

-- Step 4: Check if fees already exist
SELECT 
    'Existing Fees' as step,
    sf.*
FROM student_fees sf
WHERE sf.student_id IN (
    SELECT id FROM students WHERE school_id = 'fb9eeb8f-8d32-4b0b-b502-1602106ac1d6'
)
AND sf.academic_year LIKE '2026%';
