-- =========================================
-- LIBRARY MODULE OPTIMIZATION SCRIPT
-- =========================================
-- This script adds performance indexes and optimizations
-- to the existing library tables without recreating them.

-- =========================================
-- 1. ADD MISSING INDEXES FOR PERFORMANCE
-- =========================================

-- Index for book_id and school_id (frequently queried together)
CREATE INDEX IF NOT EXISTS idx_library_book_copies_book_school 
    ON library_book_copies(book_id, school_id);

-- Index for status filtering (frequently used in queries)
CREATE INDEX IF NOT EXISTS idx_library_book_copies_status 
    ON library_book_copies(status);

-- Composite index for finding available copies
CREATE INDEX IF NOT EXISTS idx_library_book_copies_book_status 
    ON library_book_copies(book_id, status) 
    WHERE status = 'available';

-- Index for student loans
CREATE INDEX IF NOT EXISTS idx_library_loans_student_school 
    ON library_loans(student_id, school_id);

-- Index for loan status queries
CREATE INDEX IF NOT EXISTS idx_library_loans_status 
    ON library_loans(status);

-- Index for overdue loan detection
CREATE INDEX IF NOT EXISTS idx_library_loans_active_due_date 
    ON library_loans(due_date, status) 
    WHERE status = 'active';

-- Index for school-based loan queries
CREATE INDEX IF NOT EXISTS idx_library_loans_school_status 
    ON library_loans(school_id, status);

-- Index for fines by student
CREATE INDEX IF NOT EXISTS idx_library_fines_student_paid 
    ON library_fines(student_id, school_id, paid);

-- Index for unpaid fines queries
CREATE INDEX IF NOT EXISTS idx_library_fines_unpaid 
    ON library_fines(student_id) 
    WHERE paid = false;

-- Full-text search index for book author
CREATE INDEX IF NOT EXISTS idx_library_books_author 
    ON library_books USING gin(to_tsvector('english', author));

-- Index for ISBN lookups
CREATE INDEX IF NOT EXISTS idx_library_books_isbn 
    ON library_books(isbn) 
    WHERE isbn IS NOT NULL;

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_library_books_category 
    ON library_books(category) 
    WHERE category IS NOT NULL;

-- =========================================
-- 2. ADD COMPOSITE INDEXES FOR COMMON QUERIES
-- =========================================

-- Index for loan history queries (student + school + ordered by issue_date)
CREATE INDEX IF NOT EXISTS idx_library_loans_history 
    ON library_loans(student_id, school_id, issue_date DESC);

-- Index for book copy lookups by school and accession number
CREATE INDEX IF NOT EXISTS idx_library_book_copies_school_accession 
    ON library_book_copies(school_id, accession_number);

-- =========================================
-- 3. OPTIMIZE EXISTING TRIGGERS
-- =========================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS update_book_available_copies() CASCADE;

-- Enhanced trigger function to update book counts more efficiently
CREATE OR REPLACE FUNCTION update_book_available_copies()
RETURNS TRIGGER AS $$
DECLARE
    v_book_id UUID;
BEGIN
    -- Determine which book_id to update
    v_book_id := COALESCE(NEW.book_id, OLD.book_id);
    
    -- Use a single UPDATE with subqueries for better performance
    UPDATE library_books
    SET 
        total_copies = (
            SELECT COUNT(*) 
            FROM library_book_copies
            WHERE book_id = v_book_id
        ),
        available_copies = (
            SELECT COUNT(*) 
            FROM library_book_copies
            WHERE book_id = v_book_id AND status = 'available'
        ),
        updated_at = NOW()
    WHERE id = v_book_id;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- 4. ADD HELPER VIEWS FOR COMMON QUERIES
-- =========================================

-- View for book inventory summary
CREATE OR REPLACE VIEW library_book_inventory AS
SELECT 
    b.id,
    b.school_id,
    b.title,
    b.author,
    b.isbn,
    b.category,
    b.publisher,
    b.publication_year,
    b.description,
    b.total_copies,
    b.available_copies,
    (b.total_copies - b.available_copies) AS issued_copies,
    COUNT(CASE WHEN c.status = 'lost' THEN 1 END) AS lost_copies,
    COUNT(CASE WHEN c.status = 'damaged' THEN 1 END) AS damaged_copies,
    COUNT(CASE WHEN c.status = 'maintenance' THEN 1 END) AS maintenance_copies,
    b.created_at,
    b.updated_at
FROM library_books b
LEFT JOIN library_book_copies c ON b.id = c.book_id
GROUP BY b.id;

-- View for active loans with book and student details
CREATE OR REPLACE VIEW library_active_loans_details AS
SELECT 
    l.id AS loan_id,
    l.school_id,
    l.student_id,
    l.book_copy_id,
    l.issue_date,
    l.due_date,
    l.status,
    l.fine_amount,
    l.collected_amount,
    l.notes,
    b.id AS book_id,
    b.title AS book_title,
    b.author AS book_author,
    b.isbn,
    bc.accession_number,
    bc.price AS book_price,
    CASE 
        WHEN l.status = 'active' AND l.due_date < CURRENT_DATE 
        THEN (CURRENT_DATE - l.due_date)
        ELSE 0
    END AS days_overdue,
    l.created_at,
    l.updated_at
FROM library_loans l
INNER JOIN library_book_copies bc ON l.book_copy_id = bc.id
INNER JOIN library_books b ON bc.book_id = b.id
WHERE l.status IN ('active', 'overdue');

-- View for student library statistics
CREATE OR REPLACE VIEW library_student_stats AS
SELECT 
    l.student_id,
    l.school_id,
    COUNT(CASE WHEN l.status = 'active' THEN 1 END) AS active_loans,
    COUNT(CASE WHEN l.status = 'overdue' THEN 1 END) AS overdue_loans,
    COUNT(CASE WHEN l.status = 'returned' THEN 1 END) AS total_returns,
    COUNT(CASE WHEN l.status = 'lost' THEN 1 END) AS lost_books,
    COALESCE(SUM(CASE WHEN f.paid = false THEN f.amount ELSE 0 END), 0) AS unpaid_fines,
    COALESCE(SUM(f.amount), 0) AS total_fines
FROM library_loans l
LEFT JOIN library_fines f ON l.id = f.loan_id
GROUP BY l.student_id, l.school_id;

-- =========================================
-- 5. ADD VALIDATION FUNCTION (Enhanced)
-- =========================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS check_student_library_eligibility(UUID, UUID) CASCADE;

-- Enhanced eligibility check with more details
CREATE OR REPLACE FUNCTION check_student_library_eligibility(
    p_school_id UUID, 
    p_student_id UUID
) 
RETURNS JSON AS $$
DECLARE
    v_active_loans_count INTEGER;
    v_overdue_loans_count INTEGER;
    v_unpaid_fines_total DECIMAL(10,2);
    v_max_books INTEGER := 3;
    v_is_active BOOLEAN;
BEGIN
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
            'unpaid_fines', v_unpaid_fines_total
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

-- =========================================
-- 6. ADD STATISTICS FUNCTIONS
-- =========================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_library_statistics(UUID) CASCADE;

-- Function to get library statistics for a school
CREATE OR REPLACE FUNCTION get_library_statistics(p_school_id UUID)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'total_books', COUNT(DISTINCT b.id),
        'total_copies', COALESCE(SUM(b.total_copies), 0),
        'available_copies', COALESCE(SUM(b.available_copies), 0),
        'issued_copies', COALESCE(SUM(b.total_copies - b.available_copies), 0),
        'active_loans', (
            SELECT COUNT(*) FROM library_loans 
            WHERE school_id = p_school_id AND status = 'active'
        ),
        'overdue_loans', (
            SELECT COUNT(*) FROM library_loans 
            WHERE school_id = p_school_id AND status = 'overdue'
        ),
        'total_fines', (
            SELECT COALESCE(SUM(amount), 0) FROM library_fines 
            WHERE school_id = p_school_id
        ),
        'unpaid_fines', (
            SELECT COALESCE(SUM(amount), 0) FROM library_fines 
            WHERE school_id = p_school_id AND paid = false
        ),
        'categories', (
            SELECT json_agg(DISTINCT category) FROM library_books 
            WHERE school_id = p_school_id AND category IS NOT NULL
        )
    ) INTO v_result
    FROM library_books b
    WHERE b.school_id = p_school_id;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- 7. ADD AUTOMATED OVERDUE DETECTION
-- =========================================

-- Drop existing function if it exists (changing return type requires DROP)
DROP FUNCTION IF EXISTS mark_overdue_loans() CASCADE;

-- Improved mark_overdue_loans function with better logging
CREATE OR REPLACE FUNCTION mark_overdue_loans()
RETURNS TABLE(
    updated_count INTEGER,
    affected_students UUID[]
) AS $$
DECLARE
    v_updated_count INTEGER;
    v_affected_students UUID[];
BEGIN
    -- Update loans that are active but past due date
    WITH updated AS (
        UPDATE library_loans
        SET status = 'overdue', updated_at = NOW()
        WHERE status = 'active' 
            AND due_date < CURRENT_DATE
        RETURNING id, student_id
    )
    SELECT 
        COUNT(*)::INTEGER,
        array_agg(DISTINCT student_id)
    INTO v_updated_count, v_affected_students
    FROM updated;
    
    RETURN QUERY SELECT v_updated_count, v_affected_students;
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- 8. GRANT PERMISSIONS FOR NEW OBJECTS
-- =========================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant access to views
GRANT SELECT ON library_book_inventory TO authenticated, service_role;
GRANT SELECT ON library_active_loans_details TO authenticated, service_role;
GRANT SELECT ON library_student_stats TO authenticated, service_role;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION check_student_library_eligibility(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_library_statistics(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION mark_overdue_loans() TO service_role;

-- =========================================
-- 9. ANALYZE TABLES FOR QUERY OPTIMIZER
-- =========================================

ANALYZE library_books;
ANALYZE library_book_copies;
ANALYZE library_loans;
ANALYZE library_fines;

-- =========================================
-- MIGRATION COMPLETE
-- =========================================
-- This script adds:
-- 1. Performance indexes for faster queries
-- 2. Helpful views for common reports
-- 3. Enhanced functions with better error handling
-- 4. Statistics functions for dashboards
-- 5. Optimized triggers
-- =========================================
