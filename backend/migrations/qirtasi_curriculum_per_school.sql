-- =============================================================
-- Qirtasi curriculum: one tree per school instead of one shared tree
-- =============================================================
-- Each main school (schools.parent_school_id IS NULL) owns its own curriculum; its campuses share it.
-- Terms (the fixed T1/T2 pair) stay shared and are not editable through the API.
--
-- Run once in the Supabase SQL editor. Safe to re-run (IF NOT EXISTS / guarded steps).
-- After running, deploy the backend change (curriculum.service.ts scopes every query by school).

BEGIN;

-- 1. school_id on every per-school level ------------------------------------
ALTER TABLE qirtasi_education_stages  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE qirtasi_grades            ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE qirtasi_tracks            ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE qirtasi_subjects          ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE qirtasi_units             ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE qirtasi_lessons           ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE qirtasi_learning_outcomes ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_qirtasi_stages_school   ON qirtasi_education_stages(school_id);
CREATE INDEX IF NOT EXISTS idx_qirtasi_grades_school   ON qirtasi_grades(school_id);
CREATE INDEX IF NOT EXISTS idx_qirtasi_tracks_school   ON qirtasi_tracks(school_id);
CREATE INDEX IF NOT EXISTS idx_qirtasi_subjects_school ON qirtasi_subjects(school_id);
CREATE INDEX IF NOT EXISTS idx_qirtasi_units_school    ON qirtasi_units(school_id);
CREATE INDEX IF NOT EXISTS idx_qirtasi_lessons_school  ON qirtasi_lessons(school_id);
CREATE INDEX IF NOT EXISTS idx_qirtasi_outcomes_school ON qirtasi_learning_outcomes(school_id);

-- 2. Backfill the existing (shared) rows ------------------------------------
-- Today every worksheet belongs to one school family, so the existing tree goes to that family's
-- main school. If worksheets span more than one family this step stops with an error instead of
-- guessing; assign those rows by hand, then re-run.
DO $$
DECLARE
  roots UUID[];
  owner UUID;
BEGIN
  SELECT array_agg(DISTINCT COALESCE(s.parent_school_id, s.id))
    INTO roots
    FROM qirtasi_worksheets w
    JOIN schools s ON s.id = w.school_id;

  IF roots IS NULL THEN
    -- No worksheets yet: leave unowned rows as they are (they become invisible to every school);
    -- delete them or assign them manually if they should be kept.
    RAISE NOTICE 'No worksheets found; existing curriculum rows left without a school.';
    RETURN;
  END IF;
  IF array_length(roots, 1) > 1 THEN
    RAISE EXCEPTION 'Worksheets belong to % school families; assign curriculum rows manually.', array_length(roots, 1);
  END IF;
  owner := roots[1];

  UPDATE qirtasi_education_stages  SET school_id = owner WHERE school_id IS NULL;
  UPDATE qirtasi_grades            SET school_id = owner WHERE school_id IS NULL;
  UPDATE qirtasi_tracks            SET school_id = owner WHERE school_id IS NULL;
  UPDATE qirtasi_subjects          SET school_id = owner WHERE school_id IS NULL;
  UPDATE qirtasi_units             SET school_id = owner WHERE school_id IS NULL;
  UPDATE qirtasi_lessons           SET school_id = owner WHERE school_id IS NULL;
  UPDATE qirtasi_learning_outcomes SET school_id = owner WHERE school_id IS NULL;
END $$;

-- 3. Uniqueness becomes per school ------------------------------------------
-- Any UNIQUE constraint/index on these tables that doesn't include school_id (e.g. UNIQUE(key) on
-- stages, UNIQUE(stage_id, code) on grades) is recreated with school_id first, so two schools can
-- both have a "basic" stage or a grade coded "G1".
DO $$
DECLARE
  r RECORD;
  cols TEXT;
BEGIN
  FOR r IN
    SELECT c.conname, c.conrelid::regclass AS tbl, c.conkey, c.conrelid
      FROM pg_constraint c
     WHERE c.contype = 'u'
       AND c.conrelid::regclass::text IN ('qirtasi_education_stages','qirtasi_grades','qirtasi_tracks','qirtasi_subjects','qirtasi_units','qirtasi_lessons','qirtasi_learning_outcomes')
       AND NOT EXISTS (
         SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey) AND a.attname = 'school_id')
  LOOP
    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum)
      INTO cols
      FROM pg_attribute a
     WHERE a.attrelid = r.conrelid AND a.attnum = ANY (r.conkey);
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I UNIQUE (school_id, %s)', r.tbl, r.conname, cols);
    RAISE NOTICE 'Recreated % on % as UNIQUE (school_id, %)', r.conname, r.tbl, cols;
  END LOOP;

  -- Plain unique indexes (not backed by a constraint) too.
  FOR r IN
    SELECT i.indexrelid::regclass AS idx, i.indrelid::regclass AS tbl, i.indkey, i.indrelid
      FROM pg_index i
     WHERE i.indisunique AND NOT i.indisprimary
       AND i.indrelid::regclass::text IN ('qirtasi_education_stages','qirtasi_grades','qirtasi_tracks','qirtasi_subjects','qirtasi_units','qirtasi_lessons','qirtasi_learning_outcomes')
       AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = i.indexrelid)
       AND NOT EXISTS (
         SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey::int2[]) AND a.attname = 'school_id')
  LOOP
    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum)
      INTO cols
      FROM pg_attribute a
     WHERE a.attrelid = r.indrelid AND a.attnum = ANY (r.indkey::int2[]);
    EXECUTE format('DROP INDEX %s', r.idx);
    EXECUTE format('CREATE UNIQUE INDEX %s ON %s (school_id, %s)', r.idx, r.tbl, cols);
    RAISE NOTICE 'Recreated unique index % on % as (school_id, %)', r.idx, r.tbl, cols;
  END LOOP;
END $$;

COMMIT;

-- Check afterwards (expect 0 in every row once all rows have an owner):
-- SELECT 'stages', count(*) FROM qirtasi_education_stages WHERE school_id IS NULL
-- UNION ALL SELECT 'grades', count(*) FROM qirtasi_grades WHERE school_id IS NULL
-- UNION ALL SELECT 'subjects', count(*) FROM qirtasi_subjects WHERE school_id IS NULL
-- UNION ALL SELECT 'units', count(*) FROM qirtasi_units WHERE school_id IS NULL
-- UNION ALL SELECT 'lessons', count(*) FROM qirtasi_lessons WHERE school_id IS NULL;
