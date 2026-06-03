-- Migration: Add Staff and Librarian Features (Fixed for ENUMs)
-- Date: 2024-01-17
-- Description: Adds 'staff' and 'librarian' to user_role ENUM, adds custom_fields, updates RLS.

-- ============================================================================
-- STEP 1: UPDATE ENUM TYPE
-- ============================================================================

-- Safely add 'staff' and 'librarian' to the user_role ENUM.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'staff';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'librarian';

-- Remove the old CHECK constraint if it existed (redundant with ENUM usually, but clears conflicts)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- ============================================================================
-- STEP 2: ADD CUSTOM FIELDS TO STAFF TABLE
-- ============================================================================

ALTER TABLE staff ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '[]';

-- ============================================================================
-- STEP 3: UPDATE LIBRARY RLS POLICIES
-- ============================================================================

-- Helper function to check if user is admin or librarian of the school
-- Renamed parameter to avoid ambiguity with column names
CREATE OR REPLACE FUNCTION is_admin_or_librarian(check_school_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR role = 'super_admin' OR role = 'librarian')
    AND (school_id = check_school_id OR role = 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3.1 LIBRARY BOOKS
DROP POLICY IF EXISTS library_books_insert ON library_books;
DROP POLICY IF EXISTS library_books_update ON library_books;
DROP POLICY IF EXISTS library_books_delete ON library_books;

CREATE POLICY library_books_insert ON library_books FOR INSERT 
WITH CHECK (is_admin_or_librarian(school_id));

CREATE POLICY library_books_update ON library_books FOR UPDATE 
USING (is_admin_or_librarian(school_id));

CREATE POLICY library_books_delete ON library_books FOR DELETE 
USING (is_admin_or_librarian(school_id));

-- 3.2 LIBRARY COPIES
DROP POLICY IF EXISTS library_copies_insert ON library_book_copies;
DROP POLICY IF EXISTS library_copies_update ON library_book_copies;
DROP POLICY IF EXISTS library_copies_delete ON library_book_copies;

CREATE POLICY library_copies_insert ON library_book_copies FOR INSERT 
WITH CHECK (is_admin_or_librarian(school_id));

CREATE POLICY library_copies_update ON library_book_copies FOR UPDATE 
USING (is_admin_or_librarian(school_id));

CREATE POLICY library_copies_delete ON library_book_copies FOR DELETE 
USING (is_admin_or_librarian(school_id));

-- 3.3 LIBRARY LOANS
DROP POLICY IF EXISTS library_loans_insert ON library_loans;
DROP POLICY IF EXISTS library_loans_update ON library_loans;
DROP POLICY IF EXISTS library_loans_delete ON library_loans;

-- Librarians issue loans (Insert)
CREATE POLICY library_loans_insert ON library_loans FOR INSERT 
WITH CHECK (is_admin_or_librarian(school_id));

-- Librarians update loans (Return/Fine)
CREATE POLICY library_loans_update ON library_loans FOR UPDATE 
USING (is_admin_or_librarian(school_id));

-- Librarians delete loans (Undo)
CREATE POLICY library_loans_delete ON library_loans FOR DELETE 
USING (is_admin_or_librarian(school_id));

-- 3.4 LIBRARY FINES
DROP POLICY IF EXISTS library_fines_insert ON library_fines;
DROP POLICY IF EXISTS library_fines_update ON library_fines;
DROP POLICY IF EXISTS library_fines_delete ON library_fines;

CREATE POLICY library_fines_insert ON library_fines FOR INSERT 
WITH CHECK (is_admin_or_librarian(school_id));

CREATE POLICY library_fines_update ON library_fines FOR UPDATE 
USING (is_admin_or_librarian(school_id));

CREATE POLICY library_fines_delete ON library_fines FOR DELETE 
USING (is_admin_or_librarian(school_id));

-- ============================================================================
-- STEP 4: MIGRATION COMPLETE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Staff and Librarian Features Migration Complete';
END $$;
