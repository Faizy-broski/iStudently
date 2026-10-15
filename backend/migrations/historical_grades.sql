-- =============================================================
-- Historical grades: grades a student earned before they joined (or before the school used Studently)
-- =============================================================
-- Backs two admin pages that the web already has but that had no tables or API:
--   /admin/grades/history-marking-periods  -> history_marking_periods
--   /admin/grades/historical-grades        -> student_history_marking_periods + historical_grades
--
-- Run once in the Supabase SQL editor. Safe to re-run (IF NOT EXISTS everywhere).
-- After running, deploy the backend (routes/history-marking-periods.routes.ts, routes/historical-grades.routes.ts).
-- The app and API use the service role; RLS is on with no policies so browsers cannot read these tables directly.

BEGIN;

-- 1. Past marking periods (a school year, semester or quarter that is not part of the current calendar)
CREATE TABLE IF NOT EXISTS history_marking_periods (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  campus_id      UUID REFERENCES schools(id) ON DELETE CASCADE,
  mp_type        TEXT NOT NULL DEFAULT 'quarter' CHECK (mp_type IN ('year', 'semester', 'quarter')),
  name           TEXT NOT NULL,
  short_name     TEXT,
  post_end_date  DATE,
  school_year    TEXT NOT NULL DEFAULT '',
  sort_order     INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_history_mps_school ON history_marking_periods(school_id);
CREATE INDEX IF NOT EXISTS idx_history_mps_campus ON history_marking_periods(campus_id);

-- 2. Which past marking periods a student has grades for, and their grade level at the time
CREATE TABLE IF NOT EXISTS student_history_marking_periods (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id          UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id         UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  marking_period_id  UUID NOT NULL REFERENCES history_marking_periods(id) ON DELETE CASCADE,
  grade_level        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, marking_period_id)
);
CREATE INDEX IF NOT EXISTS idx_student_history_mps_student ON student_history_marking_periods(student_id);

-- 3. One row per course in a past marking period
CREATE TABLE IF NOT EXISTS historical_grades (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id          UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id         UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  marking_period_id  UUID NOT NULL REFERENCES history_marking_periods(id) ON DELETE CASCADE,
  course_period_id   UUID REFERENCES course_periods(id) ON DELETE SET NULL,
  course_title       TEXT NOT NULL,
  grade_letter       TEXT,
  grade_percent      NUMERIC(6, 2),
  gp_scale           NUMERIC(5, 2),
  unweighted_gp      NUMERIC(5, 2),
  credit_attempted   NUMERIC(6, 2),
  credit_earned      NUMERIC(6, 2),
  comment            TEXT,
  class_rank         INTEGER,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_historical_grades_student_mp ON historical_grades(student_id, marking_period_id);

ALTER TABLE history_marking_periods         ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_history_marking_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_grades               ENABLE ROW LEVEL SECURITY;

COMMIT;
