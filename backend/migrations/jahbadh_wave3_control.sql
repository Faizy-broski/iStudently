-- =============================================================
-- Jahbadh exam control — Wave 3 (brief Part C/E alignment, 2026-2027 package)
-- =============================================================
-- Run after jahbadh_control.sql, jahbadh_wave1_2026_2027.sql and jahbadh_wave2.sql. Safe to re-run.
--
-- 1. Exam parts (C5 exam_parts, C6.7, C11-9, C11-10): a subject's exam split into parts. Scores are entered
--    per part (jc_scores.subject_key = '<subject_key>~<part_index>'), the subject score is the sum of its parts,
--    and parts linked to a grade-sheet sub-item export to jg_subitem_marks.
-- 2. Second round (E3): each second-round student sits only the subjects the grades module referred them in.
-- 3. Audit sample: "error found" column of the workbook sheet «عينة التدقيق».
-- National ID (profiles.national_id) and مستجد/معيد (students.enrollment_status, jahbadh_wave2.sql) are read
-- live from the platform student; nothing is copied.

BEGIN;

CREATE TABLE IF NOT EXISTS jc_exam_parts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL REFERENCES jc_sessions(id) ON DELETE CASCADE,
  grade_level_id UUID NOT NULL REFERENCES grade_levels(id) ON DELETE CASCADE,
  subject_key    TEXT NOT NULL,
  part_index     SMALLINT NOT NULL CHECK (part_index BETWEEN 1 AND 20),
  name           TEXT NOT NULL,
  max_score      NUMERIC(6,2) NOT NULL CHECK (max_score > 0),
  -- grade-sheet sub-item the part's score exports to (jg_subitems, Wave 1); NULL = summed into the component
  subitem_id     UUID REFERENCES jg_subitems(id) ON DELETE SET NULL,
  UNIQUE (session_id, grade_level_id, subject_key, part_index)
);
CREATE INDEX IF NOT EXISTS idx_jc_exam_parts_session ON jc_exam_parts(session_id, grade_level_id);

-- Subjects a second-round student sits (memo subject keys); NULL = every subject of the grade.
ALTER TABLE jc_students ADD COLUMN IF NOT EXISTS round2_subjects TEXT[];

ALTER TABLE jc_audit_sample ADD COLUMN IF NOT EXISTS error_found BOOLEAN NOT NULL DEFAULT false;

-- RLS like the other jc_* tables: the API uses the service role; no direct client access.
ALTER TABLE jc_exam_parts ENABLE ROW LEVEL SECURITY;

COMMIT;
