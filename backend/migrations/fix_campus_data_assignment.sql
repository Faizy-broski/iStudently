-- =========================================
-- FIX CAMPUS DATA ASSIGNMENT
-- This script helps identify and fix campus_id assignments
-- =========================================

-- Step 1: Check current data structure
-- Run this to see what you have:

SELECT 
    'Main School' as type,
    s.id,
    s.name,
    s.parent_school_id
FROM schools s
WHERE s.parent_school_id IS NULL;

SELECT 
    'Campuses' as type,
    s.id,
    s.name,
    s.parent_school_id
FROM schools s
WHERE s.parent_school_id IS NOT NULL;

-- Step 2: Check existing grade levels
SELECT 
    g.id,
    g.name,
    g.school_id,
    g.campus_id,
    s.name as school_name,
    s.parent_school_id
FROM grade_levels g
JOIN schools s ON s.id = g.school_id
ORDER BY g.order_index;

-- Step 3: OPTION A - Share main school's academics with all campuses
-- This makes grade levels available to all campuses but still campus-specific for new ones
-- Uncomment and run if you want to share existing data:

/*
-- Update RLS policies to allow access to main school's records OR campus-specific records
DROP POLICY IF EXISTS grade_levels_campus_policy ON grade_levels;
CREATE POLICY grade_levels_campus_policy ON grade_levels
FOR ALL
USING (
    -- Allow access if campus_id matches selected campus
    campus_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    -- Allow access if campus_id is main school and user's campus is a child
    campus_id = (
        SELECT parent_school_id 
        FROM schools 
        WHERE id = (SELECT school_id FROM profiles WHERE id = auth.uid())
    )
);

DROP POLICY IF EXISTS sections_campus_policy ON sections;
CREATE POLICY sections_campus_policy ON sections
FOR ALL
USING (
    campus_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    campus_id = (
        SELECT parent_school_id 
        FROM schools 
        WHERE id = (SELECT school_id FROM profiles WHERE id = auth.uid())
    )
);

DROP POLICY IF EXISTS subjects_campus_policy ON subjects;
CREATE POLICY subjects_campus_policy ON subjects
FOR ALL
USING (
    campus_id = (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR
    campus_id = (
        SELECT parent_school_id 
        FROM schools 
        WHERE id = (SELECT school_id FROM profiles WHERE id = auth.uid())
    )
);
*/

-- Step 4: OPTION B - Duplicate main school records to each campus
-- This creates independent copies for each campus
-- Uncomment and run if you want separate data per campus:

/*
DO $$
DECLARE
    main_school_id UUID;
    campus_record RECORD;
BEGIN
    -- Get main school ID
    SELECT id INTO main_school_id FROM schools WHERE parent_school_id IS NULL LIMIT 1;
    
    -- For each campus
    FOR campus_record IN 
        SELECT id FROM schools WHERE parent_school_id = main_school_id
    LOOP
        -- Duplicate grade levels
        INSERT INTO grade_levels (campus_id, school_id, name, order_index, base_fee, is_active, created_by, created_at)
        SELECT 
            campus_record.id,
            campus_record.id,
            name,
            order_index,
            base_fee,
            is_active,
            created_by,
            NOW()
        FROM grade_levels
        WHERE campus_id = main_school_id
        ON CONFLICT (campus_id, name) DO NOTHING;
        
        -- Duplicate sections (matching grades by name)
        INSERT INTO sections (campus_id, school_id, grade_level_id, name, capacity, current_strength, is_active, created_by, created_at)
        SELECT 
            campus_record.id,
            campus_record.id,
            new_g.id,
            s.name,
            s.capacity,
            0, -- Reset student count
            s.is_active,
            s.created_by,
            NOW()
        FROM sections s
        JOIN grade_levels old_g ON old_g.id = s.grade_level_id
        JOIN grade_levels new_g ON new_g.campus_id = campus_record.id AND new_g.name = old_g.name
        WHERE s.campus_id = main_school_id
        ON CONFLICT (campus_id, grade_level_id, name) DO NOTHING;
        
        -- Duplicate subjects (matching grades by name)
        INSERT INTO subjects (campus_id, school_id, grade_level_id, name, code, subject_type, is_active, created_by, created_at)
        SELECT 
            campus_record.id,
            campus_record.id,
            new_g.id,
            sub.name,
            campus_record.id::text || '_' || sub.code, -- Make code unique per campus
            sub.subject_type,
            sub.is_active,
            sub.created_by,
            NOW()
        FROM subjects sub
        JOIN grade_levels old_g ON old_g.id = sub.grade_level_id
        JOIN grade_levels new_g ON new_g.campus_id = campus_record.id AND new_g.name = old_g.name
        WHERE sub.campus_id = main_school_id
        ON CONFLICT (campus_id, code) DO NOTHING;
    END LOOP;
    
    RAISE NOTICE 'Successfully duplicated academics data to all campuses';
END $$;
*/
