-- =====================================================
-- Fee Adjustments & Enhancements Migration
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Add late_fee_applied_at timestamp to student_fees
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'student_fees' AND column_name = 'late_fee_applied_at'
    ) THEN
        ALTER TABLE student_fees ADD COLUMN late_fee_applied_at TIMESTAMPTZ;
    END IF;
END $$;

-- 2. Create fee_adjustments audit table
CREATE TABLE IF NOT EXISTS fee_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_fee_id UUID NOT NULL REFERENCES student_fees(id) ON DELETE CASCADE,
    adjusted_by UUID NOT NULL REFERENCES profiles(id),
    adjustment_type VARCHAR(50) NOT NULL CHECK (adjustment_type IN (
        'late_fee_removed', 
        'late_fee_reduced', 
        'custom_discount', 
        'fee_waived', 
        'discount_restored'
    )),
    amount_before DECIMAL(10,2) NOT NULL,
    amount_after DECIMAL(10,2) NOT NULL,
    adjustment_amount DECIMAL(10,2) NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fee_adjustments
CREATE INDEX IF NOT EXISTS idx_fee_adjustments_student_fee ON fee_adjustments(student_fee_id);
CREATE INDEX IF NOT EXISTS idx_fee_adjustments_school ON fee_adjustments(school_id, created_at DESC);

-- Enable RLS
ALTER TABLE fee_adjustments ENABLE ROW LEVEL SECURITY;

-- Admin-only access policy
CREATE POLICY fee_adjustments_admin ON fee_adjustments FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
        AND (role = 'super_admin' OR school_id = fee_adjustments.school_id)
    ));

-- 3. Add fee_month column if not exists (for preventing duplicates)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'student_fees' AND column_name = 'fee_month'
    ) THEN
        ALTER TABLE student_fees ADD COLUMN fee_month VARCHAR(7);
        -- Format: YYYY-MM, e.g., "2026-01"
    END IF;
END $$;

-- 4. Add services_amount column if not exists
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'student_fees' AND column_name = 'services_amount'
    ) THEN
        ALTER TABLE student_fees ADD COLUMN services_amount DECIMAL(10,2) DEFAULT 0;
    END IF;
END $$;

-- 5. Add discount_reason column for custom discount notes
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'student_fees' AND column_name = 'discount_reason'
    ) THEN
        ALTER TABLE student_fees ADD COLUMN discount_reason TEXT;
    END IF;
END $$;

-- Done!
SELECT 'Fee adjustments migration completed!' AS status;
