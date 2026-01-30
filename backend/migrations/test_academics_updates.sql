-- Test script to verify academics update functionality after fixes
-- Run this in Supabase SQL Editor to test the functions

DO $$
DECLARE
    test_user_id UUID := '00000000-0000-0000-0000-000000000000'; -- Replace with actual user ID
    test_campus_id UUID;
    test_grade_id UUID;
    test_section_id UUID;
    test_subject_id UUID;
BEGIN
    RAISE NOTICE '🧪 Testing academics update functionality...';
    
    -- Get a test campus (replace with actual campus ID)
    SELECT id INTO test_campus_id 
    FROM schools 
    WHERE type = 'campus' 
    LIMIT 1;
    
    IF test_campus_id IS NULL THEN
        RAISE NOTICE '❌ No test campus found. Please create a campus first.';
        RETURN;
    END IF;
    
    RAISE NOTICE 'ℹ️  Using test campus: %', test_campus_id;
    
    -- Test 1: Get grades using function
    RAISE NOTICE '1️⃣  Testing get_grade_with_stats...';
    BEGIN
        PERFORM * FROM get_grade_with_stats(test_campus_id, NULL) LIMIT 1;
        RAISE NOTICE '✅ get_grade_with_stats works';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ get_grade_with_stats failed: %', SQLERRM;
    END;
    
    -- Test 2: Create a test grade level
    RAISE NOTICE '2️⃣  Testing grade level creation...';
    BEGIN
        INSERT INTO grade_levels (campus_id, school_id, name, order_index, base_fee, created_by)
        VALUES (test_campus_id, test_campus_id, 'Test Grade', 99, 1000.00, test_user_id)
        RETURNING id INTO test_grade_id;
        
        RAISE NOTICE '✅ Grade level created: %', test_grade_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Grade level creation failed: %', SQLERRM;
        RETURN;
    END;
    
    -- Test 3: Update the grade level
    RAISE NOTICE '3️⃣  Testing grade level update...';
    BEGIN
        UPDATE grade_levels 
        SET name = 'Test Grade Updated' 
        WHERE id = test_grade_id;
        
        RAISE NOTICE '✅ Grade level updated successfully';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Grade level update failed: %', SQLERRM;
    END;
    
    -- Test 4: Create a test section
    RAISE NOTICE '4️⃣  Testing section creation...';
    BEGIN
        INSERT INTO sections (campus_id, school_id, grade_level_id, name, capacity, created_by)
        VALUES (test_campus_id, test_campus_id, test_grade_id, 'Test Section', 30, test_user_id)
        RETURNING id INTO test_section_id;
        
        RAISE NOTICE '✅ Section created: %', test_section_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Section creation failed: %', SQLERRM;
    END;
    
    -- Test 5: Update the section
    IF test_section_id IS NOT NULL THEN
        RAISE NOTICE '5️⃣  Testing section update...';
        BEGIN
            UPDATE sections 
            SET name = 'Test Section Updated', capacity = 35 
            WHERE id = test_section_id;
            
            RAISE NOTICE '✅ Section updated successfully';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '❌ Section update failed: %', SQLERRM;
        END;
    END IF;
    
    -- Test 6: Create a test subject
    RAISE NOTICE '6️⃣  Testing subject creation...';
    BEGIN
        INSERT INTO subjects (campus_id, school_id, grade_level_id, name, code, subject_type, created_by)
        VALUES (test_campus_id, test_campus_id, test_grade_id, 'Test Subject', 'TST', 'theory', test_user_id)
        RETURNING id INTO test_subject_id;
        
        RAISE NOTICE '✅ Subject created: %', test_subject_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Subject creation failed: %', SQLERRM;
    END;
    
    -- Test 7: Update the subject
    IF test_subject_id IS NOT NULL THEN
        RAISE NOTICE '7️⃣  Testing subject update...';
        BEGIN
            UPDATE subjects 
            SET name = 'Test Subject Updated', code = 'TST2' 
            WHERE id = test_subject_id;
            
            RAISE NOTICE '✅ Subject updated successfully';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '❌ Subject update failed: %', SQLERRM;
        END;
    END IF;
    
    -- Clean up test data
    RAISE NOTICE '🧹 Cleaning up test data...';
    IF test_subject_id IS NOT NULL THEN
        DELETE FROM subjects WHERE id = test_subject_id;
    END IF;
    IF test_section_id IS NOT NULL THEN
        DELETE FROM sections WHERE id = test_section_id;
    END IF;
    IF test_grade_id IS NOT NULL THEN
        DELETE FROM grade_levels WHERE id = test_grade_id;
    END IF;
    
    RAISE NOTICE '✅ Test completed successfully!';
END $$;