-- Migration: Fix parent school_id mismatches
-- This fixes parents that were created with campus_id instead of base school_id
-- Parents should always belong to the base/parent school, not individual campuses

-- ============================================================================
-- STEP 1: Identify parents with campus school_ids instead of base school_ids
-- ============================================================================

-- Check for parents whose school_id is actually a campus (has a parent_school_id)
SELECT 
    p.id as parent_id,
    p.profile_id,
    p.school_id as current_school_id,
    s.name as current_school_name,
    s.parent_school_id,
    ps.name as parent_school_name
FROM parents p
JOIN schools s ON p.school_id = s.id
LEFT JOIN schools ps ON s.parent_school_id = ps.id
WHERE s.parent_school_id IS NOT NULL;

-- ============================================================================
-- STEP 2: Update parents to use the base school_id instead of campus_id
-- ============================================================================

-- UNCOMMENT BELOW TO ACTUALLY FIX THE DATA
-- This will move all parents from campuses to their parent school

/*
UPDATE parents p
SET school_id = s.parent_school_id,
    updated_at = NOW()
FROM schools s
WHERE p.school_id = s.id
  AND s.parent_school_id IS NOT NULL;
*/

-- ============================================================================
-- STEP 3: Verify the fix
-- ============================================================================

-- After running the update, verify all parents now belong to base schools
-- This query should return 0 rows if successful

/*
SELECT 
    p.id as parent_id,
    p.school_id,
    s.name as school_name,
    s.parent_school_id
FROM parents p
JOIN schools s ON p.school_id = s.id
WHERE s.parent_school_id IS NOT NULL;
*/

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. Parents are designed to be school-wide, not campus-specific
-- 2. A parent can have children in different campuses of the same school
-- 3. The parent record should always use the base school_id
-- 4. Children (students) are campus-specific through their section assignment
