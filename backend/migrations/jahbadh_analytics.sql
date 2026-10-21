-- =============================================================
-- Jahbadh grades plugin, Phase 3: analytics tools that keep their own data.
-- =============================================================
-- Run after jahbadh_report_cards.sql. Safe to re-run.
-- Dashboards, early warning, learning groups, student profiles and subject analysis are computed
-- from marks on every read; only the test item analysis and the rubrics store input.

BEGIN;

-- Test item analysis (B6-12): up to 20 questions with max score and Bloom level, scores per student.
CREATE TABLE IF NOT EXISTS jg_test_analyses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  section_id       UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  jg_subject_id    UUID REFERENCES jg_grade_subjects(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  test_date        DATE,
  questions        JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ max, level }]
  scores           JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { student_id: [number|null, …] }
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jg_test_analyses_section ON jg_test_analyses(section_id, academic_year_id);

-- Rubrics (B6-14): weighted criteria with 4 descriptive levels, levels per student, task max.
CREATE TABLE IF NOT EXISTS jg_rubrics (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  section_id       UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  max_score        NUMERIC(6,2) NOT NULL CHECK (max_score > 0),
  criteria         JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ name, weight, levels[4] }]
  levels           JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { student_id: [1-4|null, …] }
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jg_rubrics_section ON jg_rubrics(section_id, academic_year_id);

ALTER TABLE jg_test_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_rubrics       ENABLE ROW LEVEL SECURITY;

COMMIT;
