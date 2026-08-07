-- ============================================================================
-- Accounting module schema reconstruction
-- ============================================================================
-- The financial-systems audit found that accounting_categories, accounting_incomes,
-- accounting_payments, accounting_salaries, payees, payee_payments, and
-- teacher_hourly_rates are live tables the backend code depends on
-- (backend/src/services/accounting.service.ts) with NO corresponding tracked
-- migration anywhere in this repo — they were created directly against the
-- live Supabase database, outside version control. Likewise the
-- get_accounting_totals_with_fees() RPC that accounting.service.ts calls.
--
-- This migration reconstructs that schema from actual column usage observed
-- in the code, using CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE FUNCTION
-- so it is safe to run against the existing live database without touching
-- data in tables that already exist with a different (but hopefully
-- compatible) shape.
--
-- IMPORTANT: This is a best-effort reconstruction, not a verified dump of the
-- live schema. Diff this against the actual production schema before running
-- it there — column types/defaults/constraints not visible from application
-- code (e.g. exact VARCHAR lengths, extra columns, existing indexes) may not
-- match exactly.
-- ============================================================================

-- ==========================================
-- accounting_categories
-- ==========================================
CREATE TABLE IF NOT EXISTS accounting_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campus_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category_type TEXT NOT NULL CHECK (category_type IN ('incomes', 'expenses', 'common')),
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_accounting_categories_campus ON accounting_categories(campus_id);

-- ==========================================
-- accounting_incomes
-- ==========================================
CREATE TABLE IF NOT EXISTS accounting_incomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campus_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year TEXT NOT NULL,
    title TEXT NOT NULL,
    category_id UUID REFERENCES accounting_categories(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL,
    income_date DATE NOT NULL,
    comments TEXT,
    file_attached TEXT,
    payment_method TEXT DEFAULT 'cash',
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_accounting_incomes_campus_year ON accounting_incomes(campus_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_accounting_incomes_category ON accounting_incomes(category_id);

-- ==========================================
-- payees (created before accounting_payments/payee_payments, which reference it)
-- ==========================================
CREATE TABLE IF NOT EXISTS payees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    bank TEXT,
    account_number TEXT,
    swift_iban TEXT,
    bsb_bic TEXT,
    rollover BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payees_school ON payees(school_id);

-- ==========================================
-- payee_payments
-- ==========================================
CREATE TABLE IF NOT EXISTS payee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    payee_id UUID NOT NULL REFERENCES payees(id) ON DELETE CASCADE,
    academic_year_id UUID,
    amount NUMERIC(12,2) NOT NULL,
    payment_date DATE NOT NULL,
    description TEXT,
    reference_number TEXT,
    file_attached TEXT,
    payment_method TEXT DEFAULT 'cash',
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payee_payments_school ON payee_payments(school_id);
CREATE INDEX IF NOT EXISTS idx_payee_payments_payee ON payee_payments(payee_id);

-- ==========================================
-- accounting_payments (general expenses when staff_id IS NULL, staff payments otherwise)
-- ==========================================
CREATE TABLE IF NOT EXISTS accounting_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campus_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year TEXT NOT NULL,
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    category_id UUID REFERENCES accounting_categories(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL,
    payment_date DATE NOT NULL,
    comments TEXT,
    file_attached TEXT,
    receipt_number TEXT,
    payment_method TEXT DEFAULT 'cash',
    -- Optional link to a payees/payee_payments record this ledger expense represents.
    -- Nullable and read-side only for now — see the audit's "payees not linked to the
    -- expense ledger" completeness gap; write-side reconciliation is a product decision
    -- left for a follow-up, not implemented by this migration.
    payee_id UUID REFERENCES payees(id) ON DELETE SET NULL,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_accounting_payments_campus_year ON accounting_payments(campus_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_accounting_payments_category ON accounting_payments(category_id);
CREATE INDEX IF NOT EXISTS idx_accounting_payments_staff ON accounting_payments(staff_id);
CREATE INDEX IF NOT EXISTS idx_accounting_payments_payee ON accounting_payments(payee_id);

-- ==========================================
-- accounting_salaries (manual/ad-hoc salary line items distinct from salary_records)
-- ==========================================
CREATE TABLE IF NOT EXISTS accounting_salaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campus_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year TEXT NOT NULL,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    assigned_date DATE NOT NULL,
    due_date DATE,
    comments TEXT,
    file_attached TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_accounting_salaries_campus_year ON accounting_salaries(campus_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_accounting_salaries_staff ON accounting_salaries(staff_id);

-- ==========================================
-- teacher_hourly_rates
-- ==========================================
CREATE TABLE IF NOT EXISTS teacher_hourly_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    timetable_entry_id UUID NOT NULL,
    hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (teacher_id, timetable_entry_id)
);
CREATE INDEX IF NOT EXISTS idx_teacher_hourly_rates_school ON teacher_hourly_rates(school_id);

-- ==========================================
-- automation_logs (audit trail for cron.service.ts's automation runs — see
-- cron.service.ts's logAutomationRun, previously a no-op stub)
-- ==========================================
CREATE TABLE IF NOT EXISTS automation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name TEXT NOT NULL,
    details JSONB,
    success BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_automation_logs_job_name ON automation_logs(job_name, created_at DESC);

-- ==========================================
-- Safety net: if any of the tables above already existed live (in a shape that
-- predates this migration), CREATE TABLE IF NOT EXISTS is a no-op and these
-- new/fixed columns from this bug-fix pass wouldn't be added. Add them
-- explicitly so the migration is idempotent either way.
-- ==========================================
ALTER TABLE accounting_payments ADD COLUMN IF NOT EXISTS payee_id UUID REFERENCES payees(id) ON DELETE SET NULL;
ALTER TABLE accounting_payments ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';
ALTER TABLE accounting_payments ADD COLUMN IF NOT EXISTS receipt_number TEXT;
ALTER TABLE payee_payments ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';
CREATE INDEX IF NOT EXISTS idx_accounting_payments_payee ON accounting_payments(payee_id);

-- ==========================================
-- get_accounting_totals_with_fees RPC
-- ==========================================
-- Reconstructed to match the shape accounting.service.ts already expects
-- (see getTotals()/calculateTotalsManually()'s fallback, which computes the
-- same aggregates in application code when this RPC is unavailable).
CREATE OR REPLACE FUNCTION get_accounting_totals_with_fees(
    p_campus_id UUID,
    p_academic_year TEXT,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    total_incomes NUMERIC,
    total_student_payments NUMERIC,
    total_expenses NUMERIC,
    total_staff_payments NUMERIC,
    balance NUMERIC,
    general_balance NUMERIC
) AS $$
DECLARE
    v_total_incomes NUMERIC := 0;
    v_total_student_payments NUMERIC := 0;
    v_total_expenses NUMERIC := 0;
    v_total_staff_payments NUMERIC := 0;
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_total_incomes
    FROM accounting_incomes
    WHERE campus_id = p_campus_id
      AND academic_year = p_academic_year
      AND (p_start_date IS NULL OR income_date >= p_start_date)
      AND (p_end_date IS NULL OR income_date <= p_end_date);

    SELECT COALESCE(SUM(amount), 0) INTO v_total_expenses
    FROM accounting_payments
    WHERE campus_id = p_campus_id
      AND academic_year = p_academic_year
      AND staff_id IS NULL
      AND (p_start_date IS NULL OR payment_date >= p_start_date)
      AND (p_end_date IS NULL OR payment_date <= p_end_date);

    SELECT COALESCE(SUM(amount), 0) INTO v_total_staff_payments
    FROM accounting_payments
    WHERE campus_id = p_campus_id
      AND academic_year = p_academic_year
      AND staff_id IS NOT NULL
      AND (p_start_date IS NULL OR payment_date >= p_start_date)
      AND (p_end_date IS NULL OR payment_date <= p_end_date);

    SELECT COALESCE(SUM(fp.amount), 0) INTO v_total_student_payments
    FROM fee_payments fp
    INNER JOIN student_fees sf ON sf.id = fp.student_fee_id
    WHERE sf.school_id = p_campus_id
      AND sf.academic_year = p_academic_year
      AND (p_start_date IS NULL OR fp.payment_date >= p_start_date)
      AND (p_end_date IS NULL OR fp.payment_date <= p_end_date);

    RETURN QUERY SELECT
        v_total_incomes,
        v_total_student_payments,
        v_total_expenses,
        v_total_staff_payments,
        v_total_incomes + v_total_student_payments - v_total_expenses,
        v_total_incomes + v_total_student_payments - (v_total_expenses + v_total_staff_payments);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
