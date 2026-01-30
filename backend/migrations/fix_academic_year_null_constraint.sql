-- Fix academic year null constraint issue in fee generation
-- Ensures academic_year is never null when generating fees

-- Update the generate_monthly_fees function to handle missing academic years
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
    v_fee_structure_id UUID;
    v_sibling_count INTEGER;
    v_sibling_discount DECIMAL(12,2);
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
        -- Try to get current academic year
        SELECT name INTO v_academic_year
        FROM academic_years
        WHERE school_id = p_school_id
          AND is_current = true
        LIMIT 1;
        
        -- If no current academic year found, create a default one
        IF v_academic_year IS NULL THEN
            -- Generate default academic year based on current date
            IF EXTRACT(MONTH FROM CURRENT_DATE) >= 7 THEN
                -- July onwards is the new academic year
                v_academic_year := EXTRACT(YEAR FROM CURRENT_DATE) || '-' || (EXTRACT(YEAR FROM CURRENT_DATE) + 1);
            ELSE
                -- January to June is previous academic year
                v_academic_year := (EXTRACT(YEAR FROM CURRENT_DATE) - 1) || '-' || EXTRACT(YEAR FROM CURRENT_DATE);
            END IF;
            
            -- Log this for debugging
            RAISE NOTICE 'No current academic year found for school %, using default: %', p_school_id, v_academic_year;
        END IF;
    END IF;
    
    -- Ensure academic_year is never null
    IF v_academic_year IS NULL THEN
        v_academic_year := '2025-2026'; -- Ultimate fallback
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
                AND s1.school_id = p_school_id
            ) as sibling_count
        FROM students s
        WHERE s.school_id = p_school_id
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
        
        -- Get base fee for the grade level
        SELECT 
            fs.id, fs.amount
        INTO v_fee_structure_id, v_base_fee
        FROM fee_structures fs
        WHERE fs.school_id = p_school_id
          AND fs.grade_level_id = v_student.grade_level_id
          AND fs.academic_year = v_academic_year
          AND (
              p_category_ids IS NULL OR 
              fs.fee_category_id = ANY(p_category_ids)
          )
        ORDER BY fs.created_at DESC
        LIMIT 1;
        
        -- Skip if no fee structure found
        IF v_fee_structure_id IS NULL THEN
            CONTINUE;
        END IF;
        
        -- Calculate services total
        v_services_total := calculate_student_services_total(v_student.id);
        
        -- Calculate sibling discount
        v_sibling_count := COALESCE(v_student.sibling_count, 1);
        IF v_sibling_count > 1 THEN
            SELECT COALESCE(
                CASE sdt.discount_type
                    WHEN 'percentage' THEN (v_base_fee + v_services_total) * (sdt.discount_value / 100)
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
        v_final_amount := (v_base_fee + v_services_total) - v_discount_amount;
        
        -- Skip if no fees to charge
        IF v_final_amount <= 0 THEN
            CONTINUE;
        END IF;
        
        -- Create the student fee record with guaranteed non-null academic_year
        INSERT INTO student_fees (
            student_id, school_id, fee_structure_id, academic_year, fee_month, due_date,
            base_amount, sibling_discount, custom_discount,
            final_amount, amount_paid, status
        ) VALUES (
            v_student.id, p_school_id, v_fee_structure_id, v_academic_year, v_fee_month, v_due_date,
            v_base_fee + v_services_total, v_discount_amount, 0,
            v_final_amount, 0, 'pending'
        );
        
        v_fees_count := v_fees_count + 1;
        v_total := v_total + v_final_amount;
    END LOOP;
    
    RETURN QUERY SELECT v_students_count, v_fees_count, v_total;
END;
$$ LANGUAGE plpgsql;

-- Also update the service layer to provide academic_year when missing
-- This will be handled in the controller/service update

-- Grant execute permission
GRANT EXECUTE ON FUNCTION generate_monthly_fees(UUID, INTEGER, INTEGER, VARCHAR, UUID, UUID, UUID[]) TO authenticated;

DO $$ BEGIN
    RAISE NOTICE '✅ Fixed academic year null constraint issue in fee generation';
    RAISE NOTICE '   - Added fallback logic to generate default academic year when missing';
    RAISE NOTICE '   - Ensured academic_year is never null in student_fees inserts';
    RAISE NOTICE '   - Added logging for debugging missing academic years';
END $$;