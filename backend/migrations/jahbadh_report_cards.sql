-- =============================================================
-- Jahbadh grades plugin, Phase 2: report cards (brief B6-9, B7).
-- =============================================================
-- Run after jahbadh_grades.sql and jahbadh_grades_seed.sql. Safe to re-run.
--
--   jg_activity_records   art / music / PE levels, absence days and teacher note per student and stage
--   jg_school_days        school days per section and stage (for the attendance %)
--   jg_report_card_settings  the 12 optional elements, guardian tips and quotes per section
--   jg_publications       which scope of which section is released to parents and students

BEGIN;

CREATE TABLE IF NOT EXISTS jg_activity_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  section_id       UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  stage            SMALLINT NOT NULL CHECK (stage BETWEEN 1 AND 3),
  art              TEXT CHECK (art   IN ('ممتاز', 'جيد جداً', 'جيد', 'مقبول')),
  music            TEXT CHECK (music IN ('ممتاز', 'جيد جداً', 'جيد', 'مقبول')),
  pe               TEXT CHECK (pe    IN ('ممتاز', 'جيد جداً', 'جيد', 'مقبول')),
  excused_days     SMALLINT CHECK (excused_days IS NULL OR excused_days >= 0),
  unexcused_days   SMALLINT CHECK (unexcused_days IS NULL OR unexcused_days >= 0),
  teacher_note     TEXT,
  updated_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, academic_year_id, stage)
);
CREATE INDEX IF NOT EXISTS idx_jg_activity_section ON jg_activity_records(section_id, academic_year_id);

CREATE TABLE IF NOT EXISTS jg_school_days (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  section_id       UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  stage            SMALLINT NOT NULL CHECK (stage BETWEEN 1 AND 3),
  days             SMALLINT NOT NULL CHECK (days >= 0),
  UNIQUE (section_id, academic_year_id, stage)
);

CREATE TABLE IF NOT EXISTS jg_report_card_settings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  section_id       UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  -- { rank, minPass, subjectEstimate, classAverage, performanceBar, trend, badges, insight,
  --   activities, attendance, guardianTips, quote } — missing keys = on
  options          JSONB NOT NULL DEFAULT '{}'::jsonb,
  guardian_tips    JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [] = the default tips
  quotes           JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [] = the default quotes (rotated per student)
  updated_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (section_id, academic_year_id)
);

-- scope: 'stage1' | 'stage2' | 'stage3' | 'final'
CREATE TABLE IF NOT EXISTS jg_publications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  section_id       UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  scope            TEXT NOT NULL CHECK (scope IN ('stage1', 'stage2', 'stage3', 'final')),
  published_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  published_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (section_id, academic_year_id, scope)
);

ALTER TABLE jg_activity_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_school_days          ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_report_card_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_publications         ENABLE ROW LEVEL SECURITY;

COMMIT;
