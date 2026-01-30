-- Debug script to diagnose the grade level update issue
-- Run this in Supabase SQL Editor before testing the update

DO $$
DECLARE
    current_user_info RECORD;
    sample_grade_id UUID;
    test_result RECORD;
BEGIN
    RAISE NOTICE '🔍 Debugging Grade Level Update Issue...';
    RAISE NOTICE '';
    
    -- Check current user context
    RAISE NOTICE '1️⃣  Current User Context:';
    SELECT p.id, p.role, p.school_id, s.name as school_name 
    INTO current_user_info
    FROM profiles p 
    LEFT JOIN schools s ON s.id = p.school_id 
    WHERE p.id = auth.uid();
    
    IF current_user_info.id IS NOT NULL THEN
        RAISE NOTICE '   User ID: %', current_user_info.id;
        RAISE NOTICE '   Role: %', current_user_info.role;
        RAISE NOTICE '   School ID: %', current_user_info.school_id;
        RAISE NOTICE '   School Name: %', COALESCE(current_user_info.school_name, 'Not found');
    ELSE
        RAISE NOTICE '   ❌ No user context found (auth.uid() returned null)';
        RETURN;
    END IF;
    
    RAISE NOTICE '';
    
    -- Check available grade levels
    RAISE NOTICE '2️⃣  Available Grade Levels:';
    FOR test_result IN
        SELECT id, name, campus_id, school_id 
        FROM grade_levels 
        WHERE is_active = true
        ORDER BY order_index
        LIMIT 5
    LOOP
        RAISE NOTICE '   ID: % | Name: % | Campus ID: % | School ID: %', 
            test_result.id, test_result.name, test_result.campus_id, test_result.school_id;
    END LOOP;
    
    -- Get a sample grade level
    SELECT id INTO sample_grade_id 
    FROM grade_levels 
    WHERE is_active = true 
    LIMIT 1;
    
    IF sample_grade_id IS NOT NULL THEN
        RAISE NOTICE '';
        RAISE NOTICE '3️⃣  Testing Update Permission:';
        RAISE NOTICE '   Sample Grade ID: %', sample_grade_id;
        
        -- Test if user can update this grade level
        BEGIN
            UPDATE grade_levels 
            SET updated_at = NOW()
            WHERE id = sample_grade_id;
            
            GET DIAGNOSTICS test_result = ROW_COUNT;
            IF test_result > 0 THEN
                RAISE NOTICE '   ✅ Update permission works - % rows affected', test_result;
                
                -- Rollback the test change
                UPDATE grade_levels 
                SET updated_at = updated_at
                WHERE id = sample_grade_id;
            ELSE
                RAISE NOTICE '   ❌ Update permission denied - 0 rows affected';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '   ❌ Update failed with error: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE '   ❌ No grade levels found to test';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '4️⃣  Policy Check:';
    
    -- Check if policies exist
    IF EXISTS(SELECT 1 FROM pg_policies WHERE tablename = 'grade_levels' AND policyname = 'grade_levels_update_policy') THEN
        RAISE NOTICE '   ✅ grade_levels_update_policy exists';
    ELSE
        RAISE NOTICE '   ❌ grade_levels_update_policy missing';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🏁 Diagnosis Complete';
    
END $$;