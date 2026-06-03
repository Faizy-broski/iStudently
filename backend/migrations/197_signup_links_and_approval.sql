-- ============================================================
-- Migration 197: Signup Links & Admin Approval
-- ============================================================
-- NOTE: This project stores campuses as child schools (parent_school_id on schools table).
--       There is no separate `campuses` table — campus_id references schools(id).
-- ============================================================

-- Table 1: signup_links
-- Stores generated signup links with role, expiry, usage limit
CREATE TABLE IF NOT EXISTS public.signup_links (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  campus_id   UUID        REFERENCES public.schools(id) ON DELETE SET NULL, -- campus = child school
  token       TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  role        TEXT        NOT NULL CHECK (role IN ('teacher','student','parent','staff','librarian','counselor')),
  label       TEXT,
  max_uses    INTEGER     DEFAULT NULL,             -- NULL = unlimited
  use_count   INTEGER     NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ DEFAULT NULL,             -- NULL = never expires
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_by  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.signup_links IS 'Admin-generated invite links; users register via /signup/:token';
COMMENT ON COLUMN public.signup_links.token     IS 'Cryptographically random 64-char hex string (32 bytes)';
COMMENT ON COLUMN public.signup_links.max_uses  IS 'NULL = unlimited uses';
COMMENT ON COLUMN public.signup_links.campus_id IS 'Child school (campus) if link is campus-specific; NULL = school-wide';

CREATE INDEX IF NOT EXISTS signup_links_school_id_idx ON public.signup_links(school_id);
CREATE INDEX IF NOT EXISTS signup_links_token_idx     ON public.signup_links(token);

-- Table 2: pending_signups
-- Accounts created via signup link, awaiting admin approval
CREATE TABLE IF NOT EXISTS public.pending_signups (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  campus_id        UUID        REFERENCES public.schools(id) ON DELETE SET NULL,
  signup_link_id   UUID        REFERENCES public.signup_links(id) ON DELETE SET NULL,
  role             TEXT        NOT NULL,
  first_name       TEXT        NOT NULL,
  last_name        TEXT        NOT NULL,
  email            TEXT        NOT NULL,
  phone            TEXT,
  password_hash    TEXT        NOT NULL, -- AES-256 encrypted (not bcrypt — needed for account creation on approval)
  extra_data       JSONB       NOT NULL DEFAULT '{}',
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','approved','rejected')),
  reviewed_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.pending_signups IS 'User signup requests awaiting admin review and approval';
COMMENT ON COLUMN public.pending_signups.password_hash IS 'AES-256-CBC encrypted password (decrypted on approval to create auth account)';
COMMENT ON COLUMN public.pending_signups.extra_data    IS 'Additional profile fields collected during signup';

CREATE INDEX IF NOT EXISTS pending_signups_school_id_idx ON public.pending_signups(school_id);
CREATE INDEX IF NOT EXISTS pending_signups_status_idx    ON public.pending_signups(status);
CREATE INDEX IF NOT EXISTS pending_signups_email_idx     ON public.pending_signups(email);

-- Auto-update updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'signup_links_set_updated_at') THEN
    CREATE TRIGGER signup_links_set_updated_at
      BEFORE UPDATE ON public.signup_links
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'pending_signups_set_updated_at') THEN
    CREATE TRIGGER pending_signups_set_updated_at
      BEFORE UPDATE ON public.pending_signups
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- RLS
ALTER TABLE public.signup_links   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signup_links: service_role full access"
  ON public.signup_links FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "pending_signups: service_role full access"
  ON public.pending_signups FOR ALL TO service_role USING (true) WITH CHECK (true);
