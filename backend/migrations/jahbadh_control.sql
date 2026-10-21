-- =============================================================
-- Jahbadh exam control («كنترول جهبذ», brief Part C) — sessions, numbers, committees, exam day,
-- blind double entry, unmasking, appeals, quality. Part of the jahbadh_grades plugin.
-- =============================================================
-- Run after the jahbadh_grades migrations. Safe to re-run.
--
-- Anonymity: jc_secrets (secret number ↔ student) is only ever read by the backend for users with
-- secret-view rights; score endpoints for grade-entry users return secret numbers only, until the
-- session is unmasked (jc_unmask_events). The encrypted-mode KEY/OFFSET are stored encrypted.

BEGIN;

CREATE TABLE IF NOT EXISTS jc_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  campus_id         UUID REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id  UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  round             TEXT NOT NULL DEFAULT 'first' CHECK (round IN ('first', 'second')),
  parent_session_id UUID REFERENCES jc_sessions(id) ON DELETE SET NULL,
  -- target stage of the grade sheet the exam scores export to (1–3)
  stage             SMALLINT NOT NULL DEFAULT 1 CHECK (stage BETWEEN 1 AND 3),
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'registration', 'committees_locked', 'exam_running', 'grading', 'unmasked', 'published', 'archived')),
  issue_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  -- numeric session code (4 digits) printed in QR payloads; regenerating it invalidates printed codes
  session_code      TEXT NOT NULL DEFAULT lpad((floor(random() * 10000))::int::text, 4, '0'),
  settings          JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- encrypted-mode KEY and OFFSET, encrypted with CREDENTIALS_ENCRYPTION_KEY (never returned to clients)
  key_enc           TEXT,
  committees_locked_at TIMESTAMPTZ,
  numbers_generated_at TIMESTAMPTZ,
  created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jc_sessions_school ON jc_sessions(school_id, academic_year_id);

-- Who may do what in a session (besides admins, who act as control chief).
-- role: control (staff of the control), entry (grade entry), invigilator, secret (delegated secret view)
CREATE TABLE IF NOT EXISTS jc_members (
  session_id UUID NOT NULL REFERENCES jc_sessions(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('control', 'entry', 'invigilator', 'secret')),
  PRIMARY KEY (session_id, profile_id, role)
);

-- Grades in the session, their numbering code and examined subjects [{key, name, max}].
CREATE TABLE IF NOT EXISTS jc_session_grades (
  session_id     UUID NOT NULL REFERENCES jc_sessions(id) ON DELETE CASCADE,
  grade_level_id UUID NOT NULL REFERENCES grade_levels(id) ON DELETE CASCADE,
  grade_code     SMALLINT NOT NULL,
  number_code    SMALLINT NOT NULL,
  subjects       JSONB NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (session_id, grade_level_id)
);

CREATE TABLE IF NOT EXISTS jc_students (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL REFERENCES jc_sessions(id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  grade_level_id UUID NOT NULL REFERENCES grade_levels(id) ON DELETE CASCADE,
  section_id     UUID REFERENCES sections(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'participating' CHECK (status IN ('participating', 'exempt', 'withdrawn', 'transferred')),
  special_case   TEXT CHECK (special_case IN ('extra_time', 'reader', 'scribe', 'other')),
  special_note   TEXT,
  extra_minutes  SMALLINT,
  rank_in_grade  INT,
  seat_number    INT,
  global_order   INT,
  committee_id   UUID,
  seat_index     INT,
  paper_model    TEXT CHECK (paper_model IN ('A', 'B')),
  UNIQUE (session_id, student_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_jc_students_seat ON jc_students(session_id, seat_number) WHERE seat_number IS NOT NULL;

-- Restricted: secret number of each participating student.
CREATE TABLE IF NOT EXISTS jc_secrets (
  session_student_id UUID PRIMARY KEY REFERENCES jc_students(id) ON DELETE CASCADE,
  session_id         UUID NOT NULL REFERENCES jc_sessions(id) ON DELETE CASCADE,
  secret_number      INT NOT NULL,
  check_digit        SMALLINT NOT NULL,
  generation_mode    TEXT NOT NULL CHECK (generation_mode IN ('random', 'encrypted', 'simple')),
  generated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE (session_id, secret_number)
);

CREATE TABLE IF NOT EXISTS jc_committees (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES jc_sessions(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  room_label       TEXT,
  capacity         INT NOT NULL DEFAULT 0 CHECK (capacity >= 0),
  seat_columns     SMALLINT NOT NULL DEFAULT 4 CHECK (seat_columns BETWEEN 1 AND 12),
  order_index      INT NOT NULL DEFAULT 0,
  is_special_needs BOOLEAN NOT NULL DEFAULT false,
  invigilator1_id  UUID REFERENCES staff(id) ON DELETE SET NULL,
  invigilator2_id  UUID REFERENCES staff(id) ON DELETE SET NULL,
  notes            TEXT
);
CREATE INDEX IF NOT EXISTS idx_jc_committees_session ON jc_committees(session_id, order_index);

CREATE TABLE IF NOT EXISTS jc_exam_days (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES jc_sessions(id) ON DELETE CASCADE,
  exam_date        DATE NOT NULL,
  subject_key      TEXT NOT NULL,
  subject_name     TEXT NOT NULL,
  grade_codes      SMALLINT[] NOT NULL DEFAULT '{}',
  start_time       TIME,
  end_time         TIME,
  duration_minutes SMALLINT
);
CREATE INDEX IF NOT EXISTS idx_jc_days_session ON jc_exam_days(session_id, exam_date);

CREATE TABLE IF NOT EXISTS jc_invigilators (
  session_id       UUID NOT NULL REFERENCES jc_sessions(id) ON DELETE CASCADE,
  staff_id         UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  specialization   TEXT,
  available        BOOLEAN NOT NULL DEFAULT true,
  unavailable_days UUID[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (session_id, staff_id)
);

CREATE TABLE IF NOT EXISTS jc_invigilation (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES jc_sessions(id) ON DELETE CASCADE,
  exam_day_id  UUID NOT NULL REFERENCES jc_exam_days(id) ON DELETE CASCADE,
  committee_id UUID REFERENCES jc_committees(id) ON DELETE CASCADE,
  staff_id     UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  slot         SMALLINT NOT NULL,
  is_reserve   BOOLEAN NOT NULL DEFAULT false,
  is_manual    BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_jc_invigilation_day ON jc_invigilation(exam_day_id);

CREATE TABLE IF NOT EXISTS jc_attendance (
  exam_day_id        UUID NOT NULL REFERENCES jc_exam_days(id) ON DELETE CASCADE,
  session_student_id UUID NOT NULL REFERENCES jc_students(id) ON DELETE CASCADE,
  state              TEXT NOT NULL CHECK (state IN ('present', 'absent', 'late', 'exit')),
  minutes_late       SMALLINT,
  recorded_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  recorded_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (exam_day_id, session_student_id)
);

CREATE TABLE IF NOT EXISTS jc_violations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID NOT NULL REFERENCES jc_sessions(id) ON DELETE CASCADE,
  exam_day_id        UUID NOT NULL REFERENCES jc_exam_days(id) ON DELETE CASCADE,
  session_student_id UUID NOT NULL REFERENCES jc_students(id) ON DELETE CASCADE,
  type               TEXT NOT NULL,
  action_taken       TEXT,
  invigilator_id     UUID REFERENCES staff(id) ON DELETE SET NULL,
  notes              TEXT,
  recorded_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  recorded_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jc_envelopes (
  exam_day_id   UUID NOT NULL REFERENCES jc_exam_days(id) ON DELETE CASCADE,
  committee_id  UUID NOT NULL REFERENCES jc_committees(id) ON DELETE CASCADE,
  booklet_count INT,
  received_at   TIMESTAMPTZ,
  received_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sealed        BOOLEAN NOT NULL DEFAULT false,
  scanned       JSONB NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (exam_day_id, committee_id)
);

CREATE TABLE IF NOT EXISTS jc_graders (
  session_id   UUID NOT NULL REFERENCES jc_sessions(id) ON DELETE CASCADE,
  subject_key  TEXT NOT NULL,
  committee_id UUID NOT NULL REFERENCES jc_committees(id) ON DELETE CASCADE,
  staff_id     UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, subject_key, committee_id)
);

-- Both entries are kept; the official score is the agreed value (or the last approved appeal).
CREATE TABLE IF NOT EXISTS jc_scores (
  session_student_id UUID NOT NULL REFERENCES jc_students(id) ON DELETE CASCADE,
  session_id         UUID NOT NULL REFERENCES jc_sessions(id) ON DELETE CASCADE,
  subject_key        TEXT NOT NULL,
  entry              SMALLINT NOT NULL CHECK (entry IN (1, 2)),
  score              NUMERIC(6,2) CHECK (score IS NULL OR score >= 0),
  is_absent          BOOLEAN NOT NULL DEFAULT false,
  entered_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entered_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_student_id, subject_key, entry)
);
CREATE INDEX IF NOT EXISTS idx_jc_scores_session ON jc_scores(session_id, subject_key, entry);

-- Append-only appeals / changes after entry.
CREATE TABLE IF NOT EXISTS jc_appeals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID NOT NULL REFERENCES jc_sessions(id) ON DELETE CASCADE,
  session_student_id UUID NOT NULL REFERENCES jc_students(id) ON DELETE CASCADE,
  subject_key        TEXT NOT NULL,
  before_score       NUMERIC(6,2),
  after_score        NUMERIC(6,2) NOT NULL,
  reason             TEXT NOT NULL,
  approved_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jc_audit_sample (
  session_id         UUID NOT NULL REFERENCES jc_sessions(id) ON DELETE CASCADE,
  session_student_id UUID NOT NULL REFERENCES jc_students(id) ON DELETE CASCADE,
  reviewed           BOOLEAN NOT NULL DEFAULT false,
  reviewer           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes              TEXT,
  PRIMARY KEY (session_id, session_student_id)
);

CREATE TABLE IF NOT EXISTS jc_unmask_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES jc_sessions(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('approve', 'unmask', 'revoke')),
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  snapshot    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jc_audit_log (
  id         BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL,
  actor_id   UUID,
  actor_role TEXT,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  TEXT,
  before     JSONB,
  after      JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jc_audit_session ON jc_audit_log(session_id, created_at DESC);

CREATE OR REPLACE FUNCTION jc_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jc_audit_log_immutable ON jc_audit_log;
CREATE TRIGGER trg_jc_audit_log_immutable BEFORE UPDATE OR DELETE ON jc_audit_log FOR EACH ROW EXECUTE FUNCTION jc_append_only();
DROP TRIGGER IF EXISTS trg_jc_appeals_immutable ON jc_appeals;
CREATE TRIGGER trg_jc_appeals_immutable BEFORE UPDATE OR DELETE ON jc_appeals FOR EACH ROW EXECUTE FUNCTION jc_append_only();
DROP TRIGGER IF EXISTS trg_jc_unmask_immutable ON jc_unmask_events;
CREATE TRIGGER trg_jc_unmask_immutable BEFORE UPDATE OR DELETE ON jc_unmask_events FOR EACH ROW EXECUTE FUNCTION jc_append_only();

ALTER TABLE jc_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE jc_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE jc_session_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE jc_students       ENABLE ROW LEVEL SECURITY;
ALTER TABLE jc_secrets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE jc_committees     ENABLE ROW LEVEL SECURITY;
ALTER TABLE jc_exam_days      ENABLE ROW LEVEL SECURITY;
ALTER TABLE jc_invigilators   ENABLE ROW LEVEL SECURITY;
ALTER TABLE jc_invigilation   ENABLE ROW LEVEL SECURITY;
ALTER TABLE jc_attendance     ENABLE ROW LEVEL SECURITY;
ALTER TABLE jc_violations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE jc_envelopes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE jc_graders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE jc_scores         ENABLE ROW LEVEL SECURITY;
ALTER TABLE jc_appeals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE jc_audit_sample   ENABLE ROW LEVEL SECURITY;
ALTER TABLE jc_unmask_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE jc_audit_log      ENABLE ROW LEVEL SECURITY;

COMMIT;
