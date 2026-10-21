-- =============================================================
-- Jahbadh grades plugin (jahbadh_grades): official Libyan grade distribution, marks,
-- second round, stage locks, settings and an immutable audit log.
-- =============================================================
-- Brief: docs/jahbadh/00-DESIGN.md.
--
-- Rules model the national distribution memo as DATA:
--   jg_grade_rules (one row per grade/track 1–14 and memo version)
--     └ jg_grade_subjects (subjects taught in that grade)
--         └ jg_components (assessment components per stage, max score, exam flag)
-- school_id NULL rows are the platform template (seeded by jahbadh_grades_seed.sql).
-- A school gets its own editable copy on first setup (POST /jahbadh-grades/setup), so its marks
-- always point at its own components and memo edits never touch other schools.
--
-- Totals, results, ranks and decisions are NOT stored: they are recomputed on every read by the
-- engine (packages/shared-utils/src/jahbadh/engine.ts).
--
-- Run once in the Supabase SQL editor, then run jahbadh_grades_seed.sql. Safe to re-run.

BEGIN;

-- 1. Rules (memo as data) ---------------------------------------------------
CREATE TABLE IF NOT EXISTS jg_grade_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID REFERENCES schools(id) ON DELETE CASCADE,  -- NULL = platform template
  version_label    TEXT NOT NULL DEFAULT '2024-2025',
  grade_code       SMALLINT NOT NULL CHECK (grade_code BETWEEN 1 AND 14),
  name             TEXT NOT NULL,
  level            TEXT NOT NULL CHECK (level IN ('basic', 'secondary')),
  track            TEXT CHECK (track IN ('science', 'humanities')),
  system_name      TEXT NOT NULL,
  no_fail          BOOLEAN NOT NULL DEFAULT false,
  total_min        NUMERIC(5,4) NOT NULL DEFAULT 0.5 CHECK (total_min BETWEEN 0 AND 1),
  exam_min         NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (exam_min BETWEEN 0 AND 1),
  stage_names      JSONB NOT NULL DEFAULT '[]'::jsonb,              -- [s1, s2, s3|null]
  rule_text        TEXT NOT NULL DEFAULT '',
  certificate_name TEXT,
  next_grade_name  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_jg_grade_rules
  ON jg_grade_rules (COALESCE(school_id, '00000000-0000-0000-0000-000000000000'::uuid), version_label, grade_code);

CREATE TABLE IF NOT EXISTS jg_grade_subjects (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id        UUID NOT NULL REFERENCES jg_grade_rules(id) ON DELETE CASCADE,
  key            TEXT NOT NULL,                 -- islamic, arabic, … (stable across grades)
  name           TEXT NOT NULL,                 -- official name printed on report cards
  weekly_periods SMALLINT NOT NULL DEFAULT 0,
  display_order  SMALLINT NOT NULL DEFAULT 0,
  UNIQUE (rule_id, key)
);

CREATE TABLE IF NOT EXISTS jg_components (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES jg_grade_subjects(id) ON DELETE CASCADE,
  stage      SMALLINT NOT NULL CHECK (stage BETWEEN 1 AND 3),
  sort_order SMALLINT NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 6),
  name       TEXT NOT NULL,
  max_score  NUMERIC(6,2) NOT NULL CHECK (max_score > 0),
  is_exam    BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_jg_components_subject ON jg_components(subject_id, stage, sort_order);

-- 2. Links between the school's structure and the memo ----------------------
-- Which official grade (1–14) each school grade level follows.
CREATE TABLE IF NOT EXISTS jg_grade_level_map (
  grade_level_id UUID PRIMARY KEY REFERENCES grade_levels(id) ON DELETE CASCADE,
  school_id      UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  grade_code     SMALLINT NOT NULL CHECK (grade_code BETWEEN 1 AND 14),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jg_grade_level_map_school ON jg_grade_level_map(school_id);

-- Which platform subject (and so which course periods / teachers) teaches each memo subject.
CREATE TABLE IF NOT EXISTS jg_subject_links (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  grade_level_id UUID NOT NULL REFERENCES grade_levels(id) ON DELETE CASCADE,
  jg_subject_id  UUID NOT NULL REFERENCES jg_grade_subjects(id) ON DELETE CASCADE,
  subject_id     UUID REFERENCES subjects(id) ON DELETE SET NULL,
  UNIQUE (grade_level_id, jg_subject_id)
);

-- 3. Marks -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jg_marks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  section_id       UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  component_id     UUID NOT NULL REFERENCES jg_components(id) ON DELETE RESTRICT,
  value            NUMERIC(6,2) CHECK (value IS NULL OR value >= 0),
  is_absent        BOOLEAN NOT NULL DEFAULT false,
  source           TEXT NOT NULL DEFAULT 'teacher' CHECK (source IN ('teacher', 'control_import')),
  entered_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entered_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, component_id, academic_year_id)
);
CREATE INDEX IF NOT EXISTS idx_jg_marks_section ON jg_marks(section_id, academic_year_id);

CREATE TABLE IF NOT EXISTS jg_round2_marks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  section_id       UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  jg_subject_id    UUID NOT NULL REFERENCES jg_grade_subjects(id) ON DELETE RESTRICT,
  value            NUMERIC(6,2) NOT NULL CHECK (value >= 0),
  source           TEXT NOT NULL DEFAULT 'teacher' CHECK (source IN ('teacher', 'control_import')),
  entered_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entered_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, jg_subject_id, academic_year_id)
);
CREATE INDEX IF NOT EXISTS idx_jg_round2_section ON jg_round2_marks(section_id, academic_year_id);

-- jg_subject_id NULL = every subject of the section.
CREATE TABLE IF NOT EXISTS jg_stage_locks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  section_id       UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  jg_subject_id    UUID REFERENCES jg_grade_subjects(id) ON DELETE CASCADE,
  stage            SMALLINT NOT NULL CHECK (stage BETWEEN 1 AND 3),
  locked_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  locked_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_jg_stage_locks
  ON jg_stage_locks (section_id, academic_year_id, COALESCE(jg_subject_id, '00000000-0000-0000-0000-000000000000'::uuid), stage);

-- 4. Settings (per school, optionally per campus) ---------------------------
CREATE TABLE IF NOT EXISTS jg_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  campus_id     UUID REFERENCES schools(id) ON DELETE CASCADE,
  version_label TEXT NOT NULL DEFAULT '2024-2025',
  follow_rate   NUMERIC(5,4) NOT NULL DEFAULT 0.5  CHECK (follow_rate BETWEEN 0 AND 1),
  excel_rate    NUMERIC(5,4) NOT NULL DEFAULT 0.85 CHECK (excel_rate BETWEEN 0 AND 1),
  grading_scale JSONB NOT NULL DEFAULT
    '[{"from":0,"label":"ضعيف"},{"from":50,"label":"مقبول"},{"from":65,"label":"جيد"},{"from":75,"label":"جيد جداً"},{"from":85,"label":"ممتاز"}]'::jsonb,
  -- education office, municipality, principal, homeroom teacher, logo url …
  header        JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_jg_settings
  ON jg_settings (school_id, COALESCE(campus_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 5. Immutable audit log ----------------------------------------------------
CREATE TABLE IF NOT EXISTS jg_audit_log (
  id          BIGSERIAL PRIMARY KEY,
  school_id   UUID NOT NULL,
  actor_id    UUID,
  actor_role  TEXT,
  action      TEXT NOT NULL,   -- mark.upsert, round2.upsert, lock.create, lock.delete, rules.update, setup …
  entity      TEXT NOT NULL,   -- jg_marks, jg_round2_marks, jg_stage_locks, jg_components, …
  entity_id   TEXT,
  section_id  UUID,
  student_id  UUID,
  before      JSONB,
  after       JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jg_audit_school_time ON jg_audit_log(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jg_audit_section ON jg_audit_log(section_id, created_at DESC);

CREATE OR REPLACE FUNCTION jg_audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'jg_audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jg_audit_log_immutable ON jg_audit_log;
CREATE TRIGGER trg_jg_audit_log_immutable
  BEFORE UPDATE OR DELETE ON jg_audit_log
  FOR EACH ROW EXECUTE FUNCTION jg_audit_log_immutable();

-- 6. Student fields printed on report cards ---------------------------------
ALTER TABLE students ADD COLUMN IF NOT EXISTS nationality         TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_name         TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS place_of_birth      TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS registration_number TEXT;

-- 7. API-only access (the backend uses the service role) --------------------
ALTER TABLE jg_grade_rules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_grade_subjects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_components      ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_grade_level_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_subject_links   ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_marks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_round2_marks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_stage_locks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_audit_log       ENABLE ROW LEVEL SECURITY;

COMMIT;
