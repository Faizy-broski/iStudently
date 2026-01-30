-- Add fee_breakdown column to student_fees table
-- This will store category-wise breakdown as JSON for detailed fee challans

ALTER TABLE student_fees 
ADD COLUMN IF NOT EXISTS fee_breakdown JSONB;

-- Add fee_month column if it doesn't exist (for monthly fee tracking)
ALTER TABLE student_fees 
ADD COLUMN IF NOT EXISTS fee_month VARCHAR(7);

-- Add index for fee_month for better query performance
CREATE INDEX IF NOT EXISTS idx_student_fees_month ON student_fees(school_id, fee_month);

-- Add index for fee_breakdown for JSON queries
CREATE INDEX IF NOT EXISTS idx_student_fees_breakdown ON student_fees USING GIN (fee_breakdown);

DO $$ BEGIN
    RAISE NOTICE '✅ Added fee_breakdown column to student_fees table';
    RAISE NOTICE '   - fee_breakdown: JSONB column to store category-wise fee details';
    RAISE NOTICE '   - fee_month: VARCHAR(7) for monthly fee tracking (YYYY-MM)';
    RAISE NOTICE '   - Added appropriate indexes for performance';
    RAISE NOTICE '   - Now fee generation can create single challan with breakdown';
END $$;