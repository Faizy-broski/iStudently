-- Migration: Allow 'termly' and 'quarterly' as fee_structures.period_type values
-- Description: Widens the CHECK constraint so schools billing 3x/year (termly) or
-- 4x/year (quarterly) can label their fee structures correctly. period_type is purely
-- descriptive (never read by generation logic), so this is a label-only addition.

DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'fee_structures'
      AND tc.constraint_type = 'CHECK'
      AND ccu.column_name = 'period_type'
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE fee_structures DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

ALTER TABLE fee_structures ADD CONSTRAINT fee_structures_period_type_check
    CHECK (period_type IN ('monthly', 'termly', 'quarterly', 'semester', 'annual', 'one_time'));
