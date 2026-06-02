-- =====================================================
-- Monthly Fee Auto-Generation Function
-- Generates fees for all students including:
--   - Base tuition from fee_structures
--   - Service charges from student_services
--   - Sibling discounts
-- =====================================================

-- =====================================================
-- Helper function to get service charge for a student
-- Returns: grade-specific charge OR custom charge OR default charge
-- =====================================================
CREATE OR REPLACE FUNCTION get_student_service_charge(
    p_student_id UUID,
    p_service_id UUID
) RETURNS DECIMAL(12,2) AS $$
DECLARE
    v_charge DECIMAL(12,2);
    v_grade_level_id UUID;
    v_custom_charge DECIMAL(12,2);
BEGIN
    -- Check for custom charge first
    SELECT custom_charge INTO v_custom_charge
    FROM student_services
    WHERE student_id = p_student_id AND service_id = p_service_id AND is_active = true;
    
    IF v_custom_charge IS NOT NULL THEN
        RETURN v_custom_charge;
    END IF;
    
    -- Get student's grade level
    SELECT grade_level_id INTO v_grade_level_id
    FROM students WHERE id = p_student_id;
    
    -- Try grade-specific charge
    IF v_grade_level_id IS NOT NULL THEN
        SELECT charge_amount INTO v_charge
        FROM service_grade_charges
        WHERE service_id = p_service_id AND grade_level_id = v_grade_level_id AND is_active = true;
        
        IF v_charge IS NOT NULL THEN
            RETURN v_charge;
        END IF;
    END IF;
    
    -- Fall back to default charge
    SELECT default_charge INTO v_charge
    FROM school_services WHERE id = p_service_id;
    
    RETURN COALESCE(v_charge, 0);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Function to calculate total service charges for a student
-- Returns 0 if student_services table doesn't exist yet
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_student_services_total(
    p_student_id UUID
) RETURNS DECIMAL(12,2) AS $$
DECLARE
    v_total DECIMAL(12,2) := 0;
    v_service RECORD;
    v_table_exists BOOLEAN;
BEGIN
    -- Check if student_services table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'student_services'
    ) INTO v_table_exists;
    
    -- If table doesn't exist, return 0
    IF NOT v_table_exists THEN
        RETURN 0;
    END IF;
    
    -- Calculate services total
    FOR v_service IN 
        SELECT service_id FROM student_services 
        WHERE student_id = p_student_id AND is_active = true
    LOOP
        v_total := v_total + get_student_service_charge(p_student_id, v_service.service_id);
    END LOOP;
    
    RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- Drop existing versions of the function to avoid ambiguity
DROP FUNCTION IF EXISTS generate_monthly_fees(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS generate_monthly_fees(UUID, INTEGER, INTEGER, VARCHAR, UUID, UUID, UUID[]);

-- Function to generate monthly fees for a school
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
    
    -- Get academic year (use parameter if provided, otherwise current)
    IF p_academic_year IS NOT NULL THEN
        v_academic_year := p_academic_year;
    ELSE
        SELECT name INTO v_academic_year
        FROM academic_years
        WHERE school_id = p_school_id
          AND is_current = true
        LIMIT 1;
    END IF;
    
    -- Loop through all active students in the school
    FOR v_student IN 
        SELECT 
            s.id, s.grade_level_id, s.profile_id,
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
        WHERE s.school_id = p_school_id
          AND p.is_active = true
          AND (p_grade_level_id IS NULL OR s.grade_level_id = p_grade_level_id)
          AND (p_section_id IS NULL OR s.section_id = p_section_id)
          AND NOT EXISTS (
              -- Skip if fee already exists for this specific month
              SELECT 1 FROM student_fees sf
              WHERE sf.student_id = s.id
                AND sf.school_id = p_school_id
                AND (sf.fee_month = v_fee_month OR sf.academic_year = v_fee_month)
          )
    LOOP
        v_students_count := v_students_count + 1;
        v_base_fee := 0;
        v_services_total := 0;
        v_discount_amount := 0;
        
        -- Get base tuition from fee_structure
        -- Prioritizes: TUITION code > TF- prefix > any fee structure for the grade
        SELECT fs.id, fs.amount INTO v_fee_structure_id, v_base_fee
        FROM fee_structures fs
        JOIN fee_categories fc ON fc.id = fs.fee_category_id
        WHERE fs.school_id = p_school_id
          AND fs.grade_level_id = v_student.grade_level_id
          AND fs.is_active = true
          AND (p_category_ids IS NULL OR fc.id = ANY(p_category_ids))
        ORDER BY 
          CASE 
            WHEN fc.code = 'TUITION' THEN 1
            WHEN fc.code LIKE 'TF-%' THEN 2
            ELSE 3
          END,
          fs.created_at DESC
        LIMIT 1;
        
        v_base_fee := COALESCE(v_base_fee, 0);
        
        -- Skip if no fee structure found and no services
        IF v_fee_structure_id IS NULL AND v_base_fee = 0 THEN
            -- Log this for debugging (optional)
            RAISE NOTICE 'No fee structure found for student % in grade %', v_student.id, v_student.grade_level_id;
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
        
        -- Create the student fee record
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

-- =====================================================
-- Cron-compatible function to generate fees for all schools
-- =====================================================
DROP FUNCTION IF EXISTS generate_monthly_fees_all_schools(INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION generate_monthly_fees_all_schools(
    p_month INTEGER DEFAULT NULL,
    p_year INTEGER DEFAULT NULL
) RETURNS TABLE (
    school_id UUID,
    school_name VARCHAR(255),
    students_processed INTEGER,
    fees_created INTEGER,
    total_amount DECIMAL(12,2)
) AS $$
DECLARE
    v_school RECORD;
    v_result RECORD;
BEGIN
    FOR v_school IN SELECT s.id, s.name FROM schools s WHERE s.is_active = true
    LOOP
        SELECT * INTO v_result FROM generate_monthly_fees(v_school.id, p_month, p_year);
        RETURN QUERY SELECT v_school.id, v_school.name, v_result.students_processed, v_result.fees_created, v_result.total_amount;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Add missing columns to student_fees if needed
-- =====================================================
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'student_fees' AND column_name = 'services_amount'
    ) THEN
        ALTER TABLE student_fees ADD COLUMN services_amount DECIMAL(12,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'student_fees' AND column_name = 'fee_month'
    ) THEN
        ALTER TABLE student_fees ADD COLUMN fee_month VARCHAR(7);
        -- Backfill existing records with academic_year value if it's in YYYY-MM format
        UPDATE student_fees SET fee_month = academic_year WHERE fee_month IS NULL AND academic_year ~ '^[0-9]{4}-[0-9]{2}$';
    END IF;
END $$;
