-- =============================================================
-- Jahbadh grades — Wave 5 (insight and administration, brief B6-30 … B6-50).
-- =============================================================
-- Run after jahbadh_wave2.sql. Safe to re-run.
--
-- Nothing here stores a grade or a result: totals, decisions, predictions, audits and reports stay
-- computed. These tables keep only what the school types in (thresholds, phrases, scenarios, plans,
-- points, deadlines, end-of-year inputs) and the two records that must not change once written
-- (approval snapshots, issued verification codes).

BEGIN;

-- 1. Editable thresholds of the insight tools (edge margin, inflation gap, auditor limits, plan weeks).
CREATE TABLE IF NOT EXISTS jg_insight_settings (
  school_id   UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Phrase bank of the automatic comments (B6-33), masculine / feminine.
CREATE TABLE IF NOT EXISTS jg_phrase_bank (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  masculine   TEXT NOT NULL,
  feminine    TEXT NOT NULL,
  updated_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, key)
);

-- 3. "What-if" scenarios (B6-35): named, auditable drafts; never written to grades.
CREATE TABLE IF NOT EXISTS jg_whatif_scenarios (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  section_id       UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  params           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jg_whatif_section ON jg_whatif_scenarios(section_id, academic_year_id);

-- 4. Approval seal (B6-38): the approved table, frozen. Later changes are listed against it; every
--    mark change after it is already in jg_audit_log (who, when, before, after).
CREATE TABLE IF NOT EXISTS jg_approvals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  section_id       UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  snapshot         JSONB NOT NULL,
  note             TEXT,
  approved_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jg_approvals_section ON jg_approvals(section_id, academic_year_id, approved_at DESC);

-- 5. Verification codes printed on report cards (B6-39). The public page shows only `summary`.
CREATE TABLE IF NOT EXISTS jg_verification_codes (
  code             TEXT PRIMARY KEY,
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  section_id       UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  scope            TEXT NOT NULL,
  fingerprint      TEXT NOT NULL,
  summary          JSONB NOT NULL DEFAULT '{}'::jsonb,
  issued_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  issued_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jg_verification_section ON jg_verification_codes(section_id, academic_year_id, issued_at DESC);

-- 6. Individual support plans (B6-41): the editable actions and weeks per student and stage.
CREATE TABLE IF NOT EXISTS jg_support_plans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  section_id       UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  weeks            SMALLINT NOT NULL DEFAULT 8 CHECK (weeks BETWEEN 1 AND 40),
  school_actions   TEXT[] NOT NULL DEFAULT '{}',
  home_actions     TEXT[] NOT NULL DEFAULT '{}',
  updated_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The school-wide default actions live in jg_insight_settings.settings.support_actions.
  UNIQUE (section_id, academic_year_id, student_id)
);

-- 7. Excellence points (B6-48): five editable categories per school and the points log.
CREATE TABLE IF NOT EXISTS jg_excellence_categories (
  school_id   UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  names       TEXT[] NOT NULL,
  updated_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS jg_excellence_points (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  section_id       UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  awarded_on       DATE NOT NULL DEFAULT CURRENT_DATE,
  category         SMALLINT NOT NULL CHECK (category BETWEEN 0 AND 4),
  points           NUMERIC(6,2) NOT NULL CHECK (points BETWEEN -100 AND 100),
  note             TEXT,
  awarded_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jg_excellence_section ON jg_excellence_points(section_id, academic_year_id, awarded_on);

-- 8. Entry deadline per stage (B6-46): "late" after it.
CREATE TABLE IF NOT EXISTS jg_stage_deadlines (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  stage            SMALLINT NOT NULL CHECK (stage BETWEEN 1 AND 3),
  deadline         DATE NOT NULL,
  updated_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, academic_year_id, stage)
);

-- 9. End-of-year report inputs (B6-49): last year's figures and the free line, typed by the school.
CREATE TABLE IF NOT EXISTS jg_eoy_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  section_id       UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  manual           JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (section_id, academic_year_id)
);

-- Approval snapshots and issued codes are append-only (same guard as jg_audit_log).
CREATE OR REPLACE FUNCTION jg_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END $$;
DROP TRIGGER IF EXISTS trg_jg_approvals_append_only ON jg_approvals;
CREATE TRIGGER trg_jg_approvals_append_only BEFORE UPDATE OR DELETE ON jg_approvals FOR EACH ROW EXECUTE FUNCTION jg_append_only();
DROP TRIGGER IF EXISTS trg_jg_verification_append_only ON jg_verification_codes;
CREATE TRIGGER trg_jg_verification_append_only BEFORE UPDATE OR DELETE ON jg_verification_codes FOR EACH ROW EXECUTE FUNCTION jg_append_only();

-- Server-only access (the API checks the school); same as the other jg_* tables.
ALTER TABLE jg_insight_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_phrase_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_whatif_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_support_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_excellence_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_excellence_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_stage_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_eoy_reports ENABLE ROW LEVEL SECURITY;

COMMIT;
