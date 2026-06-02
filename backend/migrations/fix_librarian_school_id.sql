-- Fix librarian school_id to match the main school with academic years
-- Architecture: School → Campuses → Each campus has its own librarian
-- Academic years belong to the main school, not individual campuses
-- All librarians should share the same school_id to see school-level academic years

-- The academic years are in school: Springerfeild (fb9eeb8f-8d32-4b0b-b502-1602106ac1d6)
-- Update all librarians to use this main school_id
-- They will still have their campus_id for campus-specific operations

UPDATE staff
SET school_id = 'fb9eeb8f-8d32-4b0b-b502-1602106ac1d6'
WHERE profile_id IN (
    SELECT id 
    FROM profiles 
    WHERE role = 'librarian'
);

-- Also ensure librarians have their campus_id set correctly
-- (If campus_id column exists and campuses are properly set up)

-- Verify the update
SELECT 
    p.email,
    p.role,
    st.school_id,
    s.name as school_name,
    st.employee_number
FROM profiles p
JOIN staff st ON st.profile_id = p.id
JOIN schools s ON s.id = st.school_id
WHERE p.role IN ('librarian', 'admin')
ORDER BY p.role;
