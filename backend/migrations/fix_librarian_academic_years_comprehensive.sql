-- COMPREHENSIVE FIX: Academic Years Visibility for Librarians
-- 
-- ROOT CAUSE ANALYSIS:
-- =====================
-- Architecture: Parent School → Campuses (child schools)
--   - parent_school_id IS NULL = Parent School (Main)
--   - parent_school_id IS NOT NULL = Campus (Branch)
--
-- PROBLEM:
-- 1. Academic Years were created in the PARENT SCHOOL (Springerfeild)
-- 2. Librarians were assigned to individual CAMPUSES (Downtown, Prime Stars, Bay Area)
-- 3. When librarians query academic_years WHERE school_id = their_campus_id, 
--    they get empty results because academic years belong to the parent school
--
-- SOLUTION OPTIONS:
-- =====================
-- Option A: Move librarians to parent school (they still manage campus-specific resources)
-- Option B: Duplicate academic years to each campus (not recommended - data duplication)
-- Option C: Fix the query logic to check parent_school_id (requires code changes)
-- Option D: Keep academic years in parent, assign librarians to parent
--
-- We'll use Option A (simplest and most logical)

-- STEP 1: Identify the parent school ID
DO $$
DECLARE
    parent_school_id_var UUID;
BEGIN
    -- Get the parent school (where academic years exist)
    SELECT school_id INTO parent_school_id_var
    FROM academic_years
    WHERE is_current = true
    LIMIT 1;

    -- Log what we found
    RAISE NOTICE 'Parent School ID: %', parent_school_id_var;

    -- STEP 2: Update all librarians to use parent school
    -- This allows them to:
    -- - See academic years (school-wide resource)
    -- - Still manage campus-specific library resources via campus filtering
    UPDATE staff
    SET school_id = parent_school_id_var
    WHERE profile_id IN (
        SELECT id 
        FROM profiles 
        WHERE role = 'librarian'
    );

    RAISE NOTICE 'Updated % librarian records', (SELECT COUNT(*) FROM profiles WHERE role = 'librarian');
END $$;

-- STEP 3: Verify the fix
SELECT 
    '✅ AFTER FIX' as status,
    p.email,
    p.role,
    st.school_id,
    s.name as school_name,
    s.parent_school_id,
    CASE 
        WHEN s.parent_school_id IS NULL THEN '✅ In Parent School (Can see academic years)'
        ELSE '❌ In Campus (Cannot see academic years)'
    END as academic_year_visibility
FROM profiles p
JOIN staff st ON st.profile_id = p.id
JOIN schools s ON s.id = st.school_id
WHERE p.role IN ('librarian', 'admin')
ORDER BY p.role;

-- STEP 4: Verify academic years are now visible
SELECT 
    COUNT(DISTINCT ay.id) as total_academic_years,
    st.school_id,
    s.name as librarian_school,
    'Librarians should now see these academic years' as note
FROM staff st
JOIN profiles p ON p.id = st.profile_id
JOIN schools s ON s.id = st.school_id
LEFT JOIN academic_years ay ON ay.school_id = st.school_id
WHERE p.role = 'librarian'
GROUP BY st.school_id, s.name;
