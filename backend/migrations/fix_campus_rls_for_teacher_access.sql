-- Fix: Allow campus users to access main school data
-- This enables teachers at campuses to see academic_years, periods, subjects from main school

-- ============================================================================
-- STEP 1: Fix academic_years RLS - campus users can see parent school years
-- ============================================================================

DROP POLICY IF EXISTS "Users can view academic years from their school" ON academic_years;
DROP POLICY IF EXISTS "Users can view academic years from school hierarchy" ON academic_years;

CREATE POLICY "Users can view academic years from school hierarchy"
ON academic_years FOR SELECT
USING (
    -- Direct school match
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    -- Campus users can see academic years at parent school
    school_id IN (
        SELECT sch.parent_school_id 
        FROM profiles p
        JOIN schools sch ON p.school_id = sch.id
        WHERE p.id = auth.uid() AND sch.parent_school_id IS NOT NULL
    )
);

-- ============================================================================
-- STEP 2: Fix periods RLS - campus users can see parent school periods
-- ============================================================================

DROP POLICY IF EXISTS "Users can view periods from their school" ON periods;
DROP POLICY IF EXISTS "Users can view periods from school hierarchy" ON periods;

CREATE POLICY "Users can view periods from school hierarchy"
ON periods FOR SELECT
USING (
    -- Direct school match
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    -- Campus users can see periods at parent school
    school_id IN (
        SELECT sch.parent_school_id 
        FROM profiles p
        JOIN schools sch ON p.school_id = sch.id
        WHERE p.id = auth.uid() AND sch.parent_school_id IS NOT NULL
    )
);

-- ============================================================================
-- STEP 3: Fix subjects RLS - teachers can see subjects they teach
-- ============================================================================

DROP POLICY IF EXISTS "Users can view subjects from their school" ON subjects;
DROP POLICY IF EXISTS "Users can view subjects from school hierarchy" ON subjects;

CREATE POLICY "Users can view subjects from school hierarchy"
ON subjects FOR SELECT
USING (
    -- Direct school match
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    -- Campus users can see subjects at parent school
    school_id IN (
        SELECT sch.parent_school_id 
        FROM profiles p
        JOIN schools sch ON p.school_id = sch.id
        WHERE p.id = auth.uid() AND sch.parent_school_id IS NOT NULL
    )
    OR
    -- Teachers can see subjects they are assigned to teach
    id IN (
        SELECT DISTINCT subject_id 
        FROM timetable_entries 
        WHERE teacher_id IN (SELECT id FROM staff WHERE profile_id = auth.uid())
    )
);

-- ============================================================================
-- STEP 4: Fix sections RLS - teachers can see their sections
-- ============================================================================

DROP POLICY IF EXISTS "Users can view sections from their school" ON sections;
DROP POLICY IF EXISTS "Users can view sections from school hierarchy" ON sections;

CREATE POLICY "Users can view sections from school hierarchy"
ON sections FOR SELECT
USING (
    -- Direct school match
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    -- Campus users can see sections at parent school
    school_id IN (
        SELECT sch.parent_school_id 
        FROM profiles p
        JOIN schools sch ON p.school_id = sch.id
        WHERE p.id = auth.uid() AND sch.parent_school_id IS NOT NULL
    )
    OR
    -- Teachers can see sections they teach
    id IN (
        SELECT DISTINCT section_id 
        FROM timetable_entries 
        WHERE teacher_id IN (SELECT id FROM staff WHERE profile_id = auth.uid())
    )
);

-- ============================================================================
-- STEP 5: Fix grade_levels RLS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view grade levels from their school" ON grade_levels;
DROP POLICY IF EXISTS "Users can view grade levels from school hierarchy" ON grade_levels;

CREATE POLICY "Users can view grade levels from school hierarchy"
ON grade_levels FOR SELECT
USING (
    -- Direct school match
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    -- Campus users can see grade levels at parent school
    school_id IN (
        SELECT sch.parent_school_id 
        FROM profiles p
        JOIN schools sch ON p.school_id = sch.id
        WHERE p.id = auth.uid() AND sch.parent_school_id IS NOT NULL
    )
);
