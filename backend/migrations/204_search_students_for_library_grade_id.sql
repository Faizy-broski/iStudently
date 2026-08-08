-- search_students_for_library() was built for the library module and only
-- returns a display-only grade_level TEXT column, never the grade_level_id
-- UUID foreign key. It's also reused by student.service.ts to power the
-- student search used by fee generation (and possibly elsewhere), so any
-- caller relying on grade_level_id after a search silently loses it — e.g.
-- the "generate fee for one student" flow, whose client-side guard then
-- incorrectly reports "Selected student does not have a grade level
-- assigned" for students that clearly do have one.
--
-- Add grade_level_id to the returned columns. This is purely additive
-- (existing callers that don't reference the new column are unaffected —
-- see library.service.ts, which explicitly maps only the fields it wants).

DROP FUNCTION IF EXISTS search_students_for_library(UUID, TEXT, INTEGER);

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
    grade_level_id UUID,
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
        s.grade_level_id,
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
