-- =============================================================
-- Jahbadh grades — Wave 1 (memo 2026-2027): sub-items, monthly entry, Article 122/51 settings,
-- academic year ↔ memo year link.
-- =============================================================
-- Design: docs/jahbadh/00-DESIGN.md (2026-27 section). Engine: packages/shared-utils/src/jahbadh.
--
-- Run order (Supabase SQL editor, each once; all are safe to re-run):
--   1. jahbadh_grades.sql            (tables)          — already run
--   2. jahbadh_grades_seed.sql       (memo 2024-2025)  — already run
--   3. jahbadh_wave1_2026_2027.sql   (THIS FILE)
--   4. jahbadh_grades_seed_2026_2027.sql (memo 2026-2027 template: needs this file first)
--
-- Nothing computed is stored: component values from sub-items or months, trends, totals and
-- decisions are recomputed on every read by the engine.

BEGIN;

-- 1. Rules: Article 51 limit and how each component is recorded --------------
ALTER TABLE jg_grade_rules ADD COLUMN IF NOT EXISTS max_round2_subjects SMALLINT NOT NULL DEFAULT 0
  CHECK (max_round2_subjects >= 0);

-- monthly_kind: entered month by month in «سجل الأنشطة الشهري» (activity / applications / items);
-- NULL = entered once in the subject grid. divisor: component = ROUND(Σ sub-items ÷ divisor, 2).
ALTER TABLE jg_components ADD COLUMN IF NOT EXISTS monthly_kind TEXT
  CHECK (monthly_kind IN ('activity', 'applications', 'items'));
ALTER TABLE jg_components ADD COLUMN IF NOT EXISTS divisor NUMERIC(6,3) NOT NULL DEFAULT 1 CHECK (divisor > 0);

-- 2. Sub-items (brief Appendix B) ---------------------------------------------
-- component_id NULL = a branch of the subject's second-round exam (summed, divisor 1).
CREATE TABLE IF NOT EXISTS jg_subitems (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id   UUID NOT NULL REFERENCES jg_grade_subjects(id) ON DELETE CASCADE,
  component_id UUID REFERENCES jg_components(id) ON DELETE CASCADE,
  sort_order   SMALLINT NOT NULL DEFAULT 0,
  name         TEXT NOT NULL,
  max_score    NUMERIC(6,2) NOT NULL CHECK (max_score > 0)
);
CREATE INDEX IF NOT EXISTS idx_jg_subitems_component ON jg_subitems(component_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_jg_subitems_subject ON jg_subitems(subject_id);

-- Sub-items entered once (not monthly).
CREATE TABLE IF NOT EXISTS jg_subitem_marks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  section_id       UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subitem_id       UUID NOT NULL REFERENCES jg_subitems(id) ON DELETE RESTRICT,
  value            NUMERIC(6,2) CHECK (value IS NULL OR value >= 0),
  is_absent        BOOLEAN NOT NULL DEFAULT false,
  source           TEXT NOT NULL DEFAULT 'teacher' CHECK (source IN ('teacher', 'control_import')),
  entered_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entered_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, subitem_id, academic_year_id)
);
CREATE INDEX IF NOT EXISTS idx_jg_subitem_marks_section ON jg_subitem_marks(section_id, academic_year_id);

-- 3. Monthly marks («سجل الأنشطة الشهري») ---------------------------------------
-- One mark per student × (component or sub-item) × month (0–3 of the component's stage).
CREATE TABLE IF NOT EXISTS jg_monthly_marks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  section_id       UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  component_id     UUID REFERENCES jg_components(id) ON DELETE RESTRICT,
  subitem_id       UUID REFERENCES jg_subitems(id) ON DELETE RESTRICT,
  target_id        UUID GENERATED ALWAYS AS (COALESCE(component_id, subitem_id)) STORED,
  month_idx        SMALLINT NOT NULL CHECK (month_idx BETWEEN 0 AND 3),
  value            NUMERIC(6,2) CHECK (value IS NULL OR value >= 0),
  is_absent        BOOLEAN NOT NULL DEFAULT false,
  source           TEXT NOT NULL DEFAULT 'teacher' CHECK (source IN ('teacher', 'control_import')),
  entered_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entered_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((component_id IS NULL) <> (subitem_id IS NULL)),
  UNIQUE (student_id, target_id, month_idx, academic_year_id)
);
CREATE INDEX IF NOT EXISTS idx_jg_monthly_marks_section ON jg_monthly_marks(section_id, academic_year_id);

-- 4. Settings: «الرئيسية» options --------------------------------------------
ALTER TABLE jg_settings ADD COLUMN IF NOT EXISTS jabr_kasur    BOOLEAN NOT NULL DEFAULT true;   -- م 122 «جبر الكسور»
ALTER TABLE jg_settings ADD COLUMN IF NOT EXISTS jabr_plus_one BOOLEAN NOT NULL DEFAULT true;   -- م 122 «درجة واحدة في مادة واحدة»
ALTER TABLE jg_settings ADD COLUMN IF NOT EXISTS act_mode      TEXT NOT NULL DEFAULT 'average'
  CHECK (act_mode IN ('average', 'best_of_avg_last'));                                      -- «حساب الأنشطة الشهرية»
ALTER TABLE jg_settings ADD COLUMN IF NOT EXISTS month_names   JSONB NOT NULL DEFAULT
  '[["سبتمبر","أكتوبر","نوفمبر","ديسمبر"],["يناير","فبراير","مارس","أبريل"],["أبريل","مايو","—","—"]]'::jsonb;
ALTER TABLE jg_settings ADD COLUMN IF NOT EXISTS default_stage SMALLINT CHECK (default_stage BETWEEN 1 AND 3); -- NULL = «كل الكشف»

-- 5. Which memo year an academic year follows ---------------------------------
-- A year without a row follows jg_settings.version_label (the school's current memo).
CREATE TABLE IF NOT EXISTS jg_year_versions (
  academic_year_id UUID PRIMARY KEY REFERENCES academic_years(id) ON DELETE CASCADE,
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  version_label    TEXT NOT NULL,
  linked_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  linked_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jg_year_versions_school ON jg_year_versions(school_id);

-- 6. API-only access (the backend uses the service role) ------------------------
ALTER TABLE jg_subitems       ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_subitem_marks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_monthly_marks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_year_versions  ENABLE ROW LEVEL SECURITY;

COMMIT;
