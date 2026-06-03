-- Fix fee generation to properly handle "select all categories"
-- When all categories are selected, combine all fee categories into one complete challan

CREATE OR REPLACE FUNCTION generate_monthly_fees(
    p_school_id UUID,
    p_month INTEGER DEFAULT NULL,
    p_year INTEGER DEFAULT NULL,
    p_academic_year VARCHAR(20) DEFAULT NULL,
    p_grade_level_id UUID DEFAULT NULL,
    p_section_id UUID DEFAULT NULL,
    p_category_ids UUID[] DEFAULT NULL
) RETURNS TABLE (
    students_processed INTEGER,
    fees_created INTEGER,
    total_amount DECIMAL(12,2)
) AS $$
DECLARE
    v_target_month INTEGER;
    v_target_year INTEGER;
    v_fee_month VARCHAR(7);
    v_student RECORD;
    v_base_fee DECIMAL(12,2);
    v_services_total DECIMAL(12,2);
    v_discount_amount DECIMAL(12,2);
    v_final_amount DECIMAL(12,2);
    v_students_count INTEGER := 0;
    v_fees_count INTEGER := 0;
    v_total DECIMAL(12,2) := 0;
    v_due_date DATE;
    v_academic_year VARCHAR(20);
    v_sibling_count INTEGER;
    v_sibling_discount DECIMAL(12,2);
    v_fee_structure RECORD;
    v_combined_fee_amount DECIMAL(12,2);
    v_fee_structure_ids UUID[];
    v_fee_category_names TEXT[];
BEGIN
    -- Default to next month
    v_target_month := COALESCE(p_month, EXTRACT(MONTH FROM CURRENT_DATE + INTERVAL '1 month')::INTEGER);
    v_target_year := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE + INTERVAL '1 month')::INTEGER);
    v_fee_month := v_target_year || '-' || LPAD(v_target_month::TEXT, 2, '0');
    
    -- Calculate due date (5th of the month)
    v_due_date := (v_target_year || '-' || LPAD(v_target_month::TEXT, 2, '0') || '-05')::DATE;
    
    -- Get academic year with fallback to prevent null values
    IF p_academic_year IS NOT NULL THEN
        v_academic_year := p_academic_year;
    ELSE
        SELECT name INTO v_academic_year
        FROM academic_years
        WHERE school_id = p_school_id
          AND is_current = true
        LIMIT 1;
        
        -- If no current academic year found, create a default one
        IF v_academic_year IS NULL THEN
            IF EXTRACT(MONTH FROM CURRENT_DATE) >= 7 THEN
                v_academic_year := EXTRACT(YEAR FROM CURRENT_DATE) || '-' || (EXTRACT(YEAR FROM CURRENT_DATE) + 1);
            ELSE
                v_academic_year := (EXTRACT(YEAR FROM CURRENT_DATE) - 1) || '-' || EXTRACT(YEAR FROM CURRENT_DATE);
            END IF;
            RAISE NOTICE 'No current academic year found for school %, using default: %', p_school_id, v_academic_year;
        END IF;
    END IF;
    
    -- Ensure academic_year is never null
    IF v_academic_year IS NULL THEN
        v_academic_year := '2025-2026';
        RAISE NOTICE 'Using ultimate fallback academic year: %', v_academic_year;
    END IF;
    
    -- Loop through all active students in the school
    FOR v_student IN 
        SELECT 
            s.id, s.grade_level_id, s.profile_id,
            (
                SELECT COUNT(*) FROM parent_student_links psl1
                JOIN students s1 ON s1.id = psl1.student_id
                WHERE psl1.parent_id = (
                    SELECT psl2.parent_id FROM parent_student_links psl2 WHERE psl2.student_id = s.id LIMIT 1
                )
                AND s1.is_active = true
                AND s1.school_id = p_school_id
            ) as sibling_count
        FROM students s
        WHERE s.school_id = p_school_id
          AND s.is_active = true
          AND (p_grade_level_id IS NULL OR s.grade_level_id = p_grade_level_id)
          AND (
              p_section_id IS NULL OR
              s.id IN (
                  SELECT student_id FROM student_section_assignments ssa 
                  WHERE ssa.section_id = p_section_id 
                    AND ssa.is_active = true
              )
          )
          AND NOT EXISTS (
              -- Skip if fee already generated for this month
              SELECT 1 FROM student_fees sf 
              WHERE sf.student_id = s.id 
                AND sf.fee_month = v_fee_month
          )
    LOOP
        v_students_count := v_students_count + 1;
        
        -- Get all applicable fee structures for this grade level
        -- When p_category_ids IS NULL (select all), get all categories
        -- When p_category_ids is provided, get only specified categories
        v_combined_fee_amount := 0;
        v_fee_structure_ids := ARRAY[]::UUID[];
        v_fee_category_names := ARRAY[]::TEXT[];
        
        FOR v_fee_structure IN 
            SELECT 
                fs.id, fs.amount, fs.fee_category_id, fc.name as category_name
            FROM fee_structures fs
            JOIN fee_categories fc ON fc.id = fs.fee_category_id
            WHERE fs.school_id = p_school_id
              AND fs.grade_level_id = v_student.grade_level_id
              AND fs.academic_year = v_academic_year
              AND fs.is_active = true
              AND (
                  p_category_ids IS NULL OR 
                  fs.fee_category_id = ANY(p_category_ids)
              )
            ORDER BY fc.name
        LOOP
            v_combined_fee_amount := v_combined_fee_amount + v_fee_structure.amount;
            v_fee_structure_ids := array_append(v_fee_structure_ids, v_fee_structure.id);
            v_fee_category_names := array_append(v_fee_category_names, v_fee_structure.category_name);
        END LOOP;
        
        -- Skip if no fee structures found
        IF v_combined_fee_amount = 0 THEN
            CONTINUE;
        END IF;
        
        -- Calculate services total
        v_services_total := calculate_student_services_total(v_student.id);
        
        -- Calculate sibling discount
        v_sibling_count := COALESCE(v_student.sibling_count, 1);
        IF v_sibling_count > 1 THEN
            SELECT COALESCE(
                CASE sdt.discount_type
                    WHEN 'percentage' THEN (v_combined_fee_amount + v_services_total) * (sdt.discount_value / 100)
                    ELSE sdt.discount_value
                END, 0
            ) INTO v_sibling_discount
            FROM sibling_discount_tiers sdt
            WHERE sdt.school_id = p_school_id
              AND sdt.sibling_count = v_sibling_count
              AND sdt.is_active = true
            LIMIT 1;
        ELSE
            v_sibling_discount := 0;
        END IF;
        
        v_discount_amount := COALESCE(v_sibling_discount, 0);
        v_final_amount := (v_combined_fee_amount + v_services_total) - v_discount_amount;
        
        -- Skip if no fees to charge
        IF v_final_amount <= 0 THEN
            CONTINUE;
        END IF;
        
        -- Create one comprehensive student fee record that includes all selected categories
        INSERT INTO student_fees (
            student_id, school_id, academic_year, fee_month, due_date,
            base_amount, sibling_discount, custom_discount,
            final_amount, amount_paid, status,
            fee_structure_ids, fee_category_names,
            notes
        ) VALUES (
            v_student.id, p_school_id, v_academic_year, v_fee_month, v_due_date,
            v_combined_fee_amount + v_services_total, v_discount_amount, 0,
            v_final_amount, 0, 'pending',
            v_fee_structure_ids, v_fee_category_names,
            CASE 
                WHEN array_length(v_fee_category_names, 1) > 1 THEN 
                    'Combined fee for categories: ' || array_to_string(v_fee_category_names, ', ')
                ELSE 
                    'Fee for ' || v_fee_category_names[1]
            END
        );
        
        v_fees_count := v_fees_count + 1;
        v_total := v_total + v_final_amount;
    END LOOP;
    
    RETURN QUERY SELECT v_students_count, v_fees_count, v_total;
END;
$$ LANGUAGE plpgsql;

-- Also update the student_fees table to support multiple fee structures
ALTER TABLE student_fees 
ADD COLUMN IF NOT EXISTS fee_structure_ids UUID[],
ADD COLUMN IF NOT EXISTS fee_category_names TEXT[],
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Make fee_structure_id nullable since we now use fee_structure_ids array
ALTER TABLE student_fees ALTER COLUMN fee_structure_id DROP NOT NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_student_fees_structure_ids ON student_fees USING GIN (fee_structure_ids);

-- Grant execute permission
GRANT EXECUTE ON FUNCTION generate_monthly_fees(UUID, INTEGER, INTEGER, VARCHAR, UUID, UUID, UUID[]) TO authenticated;

DO $$ BEGIN
    RAISE NOTICE '✅ Fixed fee generation to properly handle "select all categories"';
    RAISE NOTICE '   - Now combines all fee categories into one comprehensive challan';
    RAISE NOTICE '   - Added fee_structure_ids array to track multiple categories';
    RAISE NOTICE '   - Added fee_category_names for better challan display';
    RAISE NOTICE '   - Added notes field to describe the fee composition';
    RAISE NOTICE '   - Individual categories still work as before';
END $$;