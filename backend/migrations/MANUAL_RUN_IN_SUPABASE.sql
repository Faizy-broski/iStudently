-- =========================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- Copy and paste this entire script into Supabase SQL Editor
-- =========================================

-- Step 1: Drop old functions (only ones we're modifying)
DROP FUNCTION IF EXISTS check_student_library_eligibility(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS search_students_for_library(UUID, TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS calculate_loan_due_date(UUID, DATE) CASCADE;
DROP FUNCTION IF EXISTS calculate_overdue_fine(UUID, DATE, DATE) CASCADE;

-- Step 2: Update eligibility check to read from school settings
CREATE OR REPLACE FUNCTION check_student_library_eligibility(
    p_school_id UUID, 
    p_student_id UUID
) 
RETURNS JSON AS $$
DECLARE
    v_active_loans_count INTEGER;
    v_overdue_loans_count INTEGER;
    v_unpaid_fines_total DECIMAL(10,2);
    v_max_books INTEGER := 3; -- default fallback
    v_is_active BOOLEAN;
    v_settings JSONB;
BEGIN
    -- Get school settings for library configuration
    SELECT settings INTO v_settings
    FROM schools
    WHERE id = p_school_id;
    
    -- Extract max_books from settings, use default if not set
    IF v_settings IS NOT NULL AND v_settings->'library'->>'max_books_per_student' IS NOT NULL THEN
        v_max_books := (v_settings->'library'->>'max_books_per_student')::INTEGER;
    END IF;

    -- Check if student is active
    SELECT is_active INTO v_is_active
    FROM profiles
    WHERE id = p_student_id AND school_id = p_school_id;
    
    IF v_is_active IS NULL THEN
        RETURN json_build_object(
            'eligible', false, 
            'message', 'Student not found'
        );
    END IF;
    
    IF v_is_active = false THEN
        RETURN json_build_object(
            'eligible', false, 
            'message', 'Student account is inactive'
        );
    END IF;

    -- Get loan and fine statistics
    SELECT 
        COUNT(*) FILTER (WHERE status IN ('active', 'overdue')),
        COUNT(*) FILTER (WHERE status = 'overdue')
    INTO v_active_loans_count, v_overdue_loans_count
    FROM library_loans
    WHERE student_id = p_student_id 
        AND school_id = p_school_id;

    SELECT COALESCE(SUM(amount), 0) INTO v_unpaid_fines_total
    FROM library_fines
    WHERE student_id = p_student_id 
        AND school_id = p_school_id 
        AND paid = false;

    -- Check eligibility conditions
    IF v_overdue_loans_count > 0 THEN
        RETURN json_build_object(
            'eligible', false, 
            'message', format('Student has %s overdue book(s)', v_overdue_loans_count),
            'active_loans', v_active_loans_count,
            'overdue_loans', v_overdue_loans_count,
            'unpaid_fines', v_unpaid_fines_total,
            'max_books', v_max_books
        );
    END IF;

    IF v_active_loans_count >= v_max_books THEN
        RETURN json_build_object(
            'eligible', false, 
            'message', format('Student has reached maximum loan limit (%s books)', v_max_books),
            'active_loans', v_active_loans_count,
            'max_books', v_max_books,
            'unpaid_fines', v_unpaid_fines_total
        );
    END IF;

    RETURN json_build_object(
        'eligible', true, 
        'message', 'Student is eligible for book loans',
        'active_loans', v_active_loans_count,
        'max_books', v_max_books,
        'unpaid_fines', v_unpaid_fines_total,
        'warnings', CASE 
            WHEN v_unpaid_fines_total > 0 
            THEN json_build_array(format('Outstanding fines: $%.2f', v_unpaid_fines_total))
            ELSE '[]'::json 
        END
    );
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create optimized student search function
CREATE OR REPLACE FUNCTION search_students_for_library(
    p_school_id UUID,
    p_search TEXT,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    student_id UUID,
    profile_id UUID,
    student_number VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    grade_level VARCHAR(20),
    is_active BOOLEAN,
    active_loans INTEGER,
    overdue_loans INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id AS student_id,
        p.id AS profile_id,
        s.student_number,
        p.first_name,
        p.last_name,
        p.email,
        s.grade_level,
        p.is_active,
        COALESCE(
            (SELECT COUNT(*)::INTEGER 
             FROM library_loans l 
             WHERE l.student_id = p.id 
             AND l.school_id = p_school_id 
             AND l.status IN ('active', 'overdue')), 
            0
        ) AS active_loans,
        COALESCE(
            (SELECT COUNT(*)::INTEGER 
             FROM library_loans l 
             WHERE l.student_id = p.id 
             AND l.school_id = p_school_id 
             AND l.status = 'overdue'), 
            0
        ) AS overdue_loans
    FROM students s
    INNER JOIN profiles p ON s.profile_id = p.id
    WHERE s.school_id = p_school_id
        AND p.is_active = true
        AND p.role = 'student'
        AND (
            p_search IS NULL 
            OR p_search = '' 
            OR LOWER(p.first_name) LIKE LOWER('%' || p_search || '%')
            OR LOWER(p.last_name) LIKE LOWER('%' || p_search || '%')
            OR LOWER(p.first_name || ' ' || p.last_name) LIKE LOWER('%' || p_search || '%')
            OR LOWER(s.student_number) LIKE LOWER('%' || p_search || '%')
        )
    ORDER BY 
        CASE 
            WHEN LOWER(p.first_name || ' ' || p.last_name) = LOWER(p_search) THEN 1
            WHEN LOWER(s.student_number) = LOWER(p_search) THEN 2
            ELSE 3
        END,
        p.last_name, 
        p.first_name
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 4: Create indexes for faster search
CREATE INDEX IF NOT EXISTS idx_profiles_name_search 
ON profiles (school_id, role, is_active, LOWER(first_name), LOWER(last_name));

CREATE INDEX IF NOT EXISTS idx_students_number_search 
ON students (school_id, LOWER(student_number));

-- Step 5: Helper function for calculating due dates
CREATE OR REPLACE FUNCTION calculate_loan_due_date(
    p_school_id UUID,
    p_issue_date DATE DEFAULT CURRENT_DATE
)
RETURNS DATE AS $$
DECLARE
    v_loan_duration INTEGER := 14;
    v_settings JSONB;
BEGIN
    SELECT settings INTO v_settings FROM schools WHERE id = p_school_id;
    
    IF v_settings IS NOT NULL AND v_settings->'library'->>'loan_duration_days' IS NOT NULL THEN
        v_loan_duration := (v_settings->'library'->>'loan_duration_days')::INTEGER;
    END IF;
    
    RETURN p_issue_date + (v_loan_duration || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 6: Helper function for calculating fines
CREATE OR REPLACE FUNCTION calculate_overdue_fine(
    p_school_id UUID,
    p_due_date DATE,
    p_return_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL(10,2) AS $$
DECLARE
    v_fine_per_day DECIMAL(10,2) := 0.50;
    v_days_overdue INTEGER;
    v_settings JSONB;
BEGIN
    v_days_overdue := GREATEST(0, p_return_date - p_due_date);
    
    IF v_days_overdue <= 0 THEN
        RETURN 0.00;
    END IF;
    
    SELECT settings INTO v_settings FROM schools WHERE id = p_school_id;
    
    IF v_settings IS NOT NULL AND v_settings->'library'->>'fine_per_day' IS NOT NULL THEN
        v_fine_per_day := (v_settings->'library'->>'fine_per_day')::DECIMAL(10,2);
    END IF;
    
    RETURN v_days_overdue * v_fine_per_day;
END;
$$ LANGUAGE plpgsql STABLE;

-- Done! Now your library settings will apply correctly
