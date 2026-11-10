-- =============================================================
-- Jahbadh Wave 6: assessment tools (brief B6 #53–61; control workbook sheets «التصحيح الآلي»,
-- «ترحيل التصحيح», «تحليل المشتتات», «تشابه الإجابات», «أخطاء الطلبة», «ورقة الفقاعات»,
-- «أرشيف الاختبارات», «الأهداف والمهارات»; grades workbook «التصحيح الآلي»).
-- =============================================================
-- Run after jahbadh_control.sql and jahbadh_wave1_2026_2027.sql. Safe to re-run.
--
-- Answer sheets are stored by session student (secret-number side): endpoints for grade-entry users
-- return secret numbers only until the session is unmasked (enforced in the backend services).

BEGIN;

-- Answer key of one exam paper (control subject) or one of its parts, per grade, versions A/B.
CREATE TABLE IF NOT EXISTS jc_answer_keys (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES jc_sessions(id) ON DELETE CASCADE,
  grade_level_id   UUID NOT NULL REFERENCES grade_levels(id) ON DELETE CASCADE,
  subject_key      TEXT NOT NULL,
  -- exam part (بند) label; '' = the whole paper
  part_key         TEXT NOT NULL DEFAULT '',
  question_count   SMALLINT NOT NULL CHECK (question_count BETWEEN 1 AND 40),
  options          SMALLINT NOT NULL DEFAULT 4 CHECK (options IN (4, 5)),
  -- per question: accepted options of version A / B (B empty = same as A), points, handling
  key_a            JSONB NOT NULL DEFAULT '[]'::jsonb,
  key_b            JSONB NOT NULL DEFAULT '[]'::jsonb,
  points           JSONB NOT NULL DEFAULT '[]'::jsonb,
  handling         JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- the score the raw points convert to (paper or part maximum)
  max_score        NUMERIC(6,2) NOT NULL CHECK (max_score > 0),
  -- learning objectives (#60): names (up to 8), objective index per version-A question, B → A map
  objective_names  JSONB NOT NULL DEFAULT '[]'::jsonb,
  objectives       JSONB NOT NULL DEFAULT '[]'::jsonb,
  b_to_a           JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- answer similarity thresholds (#55)
  similarity_min   SMALLINT NOT NULL DEFAULT 4,
  similarity_ratio NUMERIC(4,2) NOT NULL DEFAULT 0.60,
  updated_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, grade_level_id, subject_key, part_key)
);
CREATE INDEX IF NOT EXISTS idx_jc_answer_keys_session ON jc_answer_keys(session_id);

-- One student's answers for one key; the version comes from the seat (paper model) unless overridden.
CREATE TABLE IF NOT EXISTS jc_answer_sheets (
  key_id             UUID NOT NULL REFERENCES jc_answer_keys(id) ON DELETE CASCADE,
  session_student_id UUID NOT NULL REFERENCES jc_students(id) ON DELETE CASCADE,
  session_id         UUID NOT NULL REFERENCES jc_sessions(id) ON DELETE CASCADE,
  version            CHAR(1) NOT NULL DEFAULT 'A' CHECK (version IN ('A', 'B')),
  -- canonical answers: 'أ'…'ه', '' blank, '?' unreadable
  answers            JSONB NOT NULL DEFAULT '[]'::jsonb,
  source             TEXT NOT NULL DEFAULT 'typed' CHECK (source IN ('typed', 'omr')),
  entered_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entered_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- last value copied into score entry (jc_scores) and when («ترحيل التصحيح»)
  transferred_score  NUMERIC(6,2),
  transferred_entry  SMALLINT CHECK (transferred_entry IS NULL OR transferred_entry IN (1, 2)),
  transferred_at     TIMESTAMPTZ,
  PRIMARY KEY (key_id, session_student_id)
);
CREATE INDEX IF NOT EXISTS idx_jc_answer_sheets_session ON jc_answer_sheets(session_id);

-- Test archive (#59): saved keys a school can recall into any session.
CREATE TABLE IF NOT EXISTS jc_test_archive (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  grade_code       SMALLINT,
  subject_key      TEXT,
  part_key         TEXT NOT NULL DEFAULT '',
  test_date        DATE,
  question_count   SMALLINT NOT NULL CHECK (question_count BETWEEN 1 AND 40),
  options          SMALLINT NOT NULL DEFAULT 4 CHECK (options IN (4, 5)),
  key_a            JSONB NOT NULL DEFAULT '[]'::jsonb,
  key_b            JSONB NOT NULL DEFAULT '[]'::jsonb,
  points           JSONB NOT NULL DEFAULT '[]'::jsonb,
  handling         JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_score        NUMERIC(6,2),
  objective_names  JSONB NOT NULL DEFAULT '[]'::jsonb,
  objectives       JSONB NOT NULL DEFAULT '[]'::jsonb,
  b_to_a           JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- item statistics saved with the test (item bank across years): [{question, p, d, verdict}]
  item_stats       JSONB,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jc_test_archive_school ON jc_test_archive(school_id, created_at DESC);

-- #61 teacher quiz auto-grading inside the grades module: key + answers per section, target column.
CREATE TABLE IF NOT EXISTS jg_quiz_keys (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  section_id       UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  jg_subject_id    UUID NOT NULL,
  -- target grade column: a component, or a sub-item (exactly one)
  component_id     UUID,
  subitem_id       UUID,
  title            TEXT NOT NULL DEFAULT '',
  question_count   SMALLINT NOT NULL CHECK (question_count BETWEEN 1 AND 30),
  options          SMALLINT NOT NULL DEFAULT 4 CHECK (options IN (4, 5)),
  key_a            JSONB NOT NULL DEFAULT '[]'::jsonb,
  points           JSONB NOT NULL DEFAULT '[]'::jsonb,
  handling         JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- optional link to a platform quiz: its scores feed the column instead of typed answers
  platform_quiz_id UUID,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((component_id IS NULL) <> (subitem_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_jg_quiz_keys_section ON jg_quiz_keys(section_id, academic_year_id);

CREATE TABLE IF NOT EXISTS jg_quiz_answers (
  quiz_key_id      UUID NOT NULL REFERENCES jg_quiz_keys(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  answers          JSONB NOT NULL DEFAULT '[]'::jsonb,
  entered_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entered_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (quiz_key_id, student_id)
);

-- Marks written by auto-grading carry their own source tag.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname, c.conrelid::regclass AS tbl
    FROM pg_constraint c
    WHERE c.contype = 'c'
      AND c.conrelid IN ('jg_marks'::regclass, 'jg_subitem_marks'::regclass)
      AND pg_get_constraintdef(c.oid) ILIKE '%source%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;
ALTER TABLE jg_marks ADD CONSTRAINT jg_marks_source_check CHECK (source IN ('teacher', 'control_import', 'auto_grading'));
ALTER TABLE jg_subitem_marks ADD CONSTRAINT jg_subitem_marks_source_check CHECK (source IN ('teacher', 'control_import', 'auto_grading'));

ALTER TABLE jc_answer_keys   ENABLE ROW LEVEL SECURITY;
ALTER TABLE jc_answer_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE jc_test_archive  ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_quiz_keys     ENABLE ROW LEVEL SECURITY;
ALTER TABLE jg_quiz_answers  ENABLE ROW LEVEL SECURITY;

COMMIT;
