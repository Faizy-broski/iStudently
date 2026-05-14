-- Migration: Fix trigger to update both total_copies and available_copies atomically

-- Replace update function to set both counts and updated_at in a single update
CREATE OR REPLACE FUNCTION update_book_available_copies()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE library_books
    SET total_copies = (
        SELECT COUNT(*) FROM library_book_copies
        WHERE book_id = COALESCE(NEW.book_id, OLD.book_id)
    ),
    available_copies = (
        SELECT COUNT(*) FROM library_book_copies
        WHERE book_id = COALESCE(NEW.book_id, OLD.book_id) AND status = 'available'
    ),
    updated_at = NOW()
    WHERE id = COALESCE(NEW.book_id, OLD.book_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists and uses the updated function
DROP TRIGGER IF EXISTS trigger_update_book_available_copies ON library_book_copies;
CREATE TRIGGER trigger_update_book_available_copies
    AFTER INSERT OR UPDATE OR DELETE ON library_book_copies
    FOR EACH ROW EXECUTE FUNCTION update_book_available_copies();

-- Helpful note: this migration ensures total_copies and available_copies are set together
-- so database CHECK constraints like available_copies <= total_copies won't be violated
-- during bulk inserts.
