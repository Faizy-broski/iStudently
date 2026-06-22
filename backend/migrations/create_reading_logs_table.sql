-- Student Reading Logs
-- Tracks individual reading sessions with optional audio recording (14-day retention).

CREATE TABLE IF NOT EXISTS student_reading_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  school_id       UUID        NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
  book_id         UUID        REFERENCES library_books(id) ON DELETE SET NULL,
  book_title      VARCHAR(255) NOT NULL DEFAULT '',
  book_author     VARCHAR(255),
  session_date    DATE        NOT NULL DEFAULT CURRENT_DATE,
  pages_read      INTEGER,
  notes           TEXT,
  -- Supabase Storage path inside the media-recordings bucket.
  -- Nulled by the nightly cleanup cron after 14 days.
  audio_file_path TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reading_logs_student    ON student_reading_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_reading_logs_school     ON student_reading_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_reading_logs_created_at ON student_reading_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_reading_logs_audio
  ON student_reading_logs(audio_file_path)
  WHERE audio_file_path IS NOT NULL;
