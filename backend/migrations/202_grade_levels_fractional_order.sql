-- Allow fractional order_index values on grade_levels so a new grade can be
-- inserted before/between existing ones without renumbering every row.
-- Example: to insert "GK" before a grade with order_index = 1, just create
-- it with order_index = 0 (or 0.5 to slot between two existing grades) —
-- no other grade's order_index needs to change.

ALTER TABLE grade_levels
  ALTER COLUMN order_index TYPE NUMERIC(10, 4) USING order_index::NUMERIC(10, 4);

COMMENT ON COLUMN grade_levels.order_index IS
  'Used for sorting grades. Supports decimals so a new grade can be inserted between two existing ones (e.g. 0.5 between order_index 0 and 1) without renumbering the rest.';

-- The grade_levels.order_index (and anything derived from it, e.g.
-- subjects/sections helper functions exposing "grade_order") is also
-- returned by Postgres functions such as get_grade_with_stats(), whose
-- RETURNS TABLE declares that column as INTEGER. Those functions have been
-- redefined several times outside of version control (this repo's
-- migrations don't even show where next_grade_id/group_id were added), so
-- rather than guessing the live definition, patch whatever is actually
-- deployed: find every function in public whose signature declares
-- order_index/grade_order as INTEGER and recreate it with NUMERIC(10,4)
-- instead, leaving everything else about the function untouched.
DO $$
DECLARE
  rec RECORD;
  func_def TEXT;
  patched TEXT;
  patched_count INT := 0;
BEGIN
  FOR rec IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    func_def := pg_get_functiondef(rec.oid);

    -- pg_get_functiondef() always normalizes type names to lowercase, so
    -- this must match case-insensitively ('i' flag) even though the
    -- original migration text elsewhere writes NUMERIC/INTEGER uppercase.
    IF func_def ~* '(order_index|grade_order)\s+integer' THEN
      patched := regexp_replace(func_def, '(order_index|grade_order)\s+integer', '\1 NUMERIC(10,4)', 'gi');
      BEGIN
        -- CREATE OR REPLACE cannot change the row type defined by OUT
        -- parameters/RETURNS TABLE (error 42P13), so drop the old
        -- integer-returning version first, identified precisely by oid.
        EXECUTE 'DROP FUNCTION ' || rec.oid::regprocedure::text;
        EXECUTE patched;
        patched_count := patched_count + 1;
        RAISE NOTICE 'Patched function % to use NUMERIC order_index/grade_order', rec.proname;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Could not auto-patch function % — please update it manually to return order_index/grade_order as NUMERIC(10,4). Error: %', rec.proname, SQLERRM;
      END;
    END IF;
  END LOOP;

  RAISE NOTICE 'grade_levels.order_index migration: patched % function(s).', patched_count;
END $$;
