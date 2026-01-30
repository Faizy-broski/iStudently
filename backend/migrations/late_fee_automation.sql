-- =========================================
-- LATE FEE AUTOMATION
-- Run this after the main migration
-- Can be scheduled via pg_cron or external cron
-- =========================================

-- Function to apply late fees to overdue student_fees
CREATE OR REPLACE FUNCTION apply_late_fees()
RETURNS TABLE(
    fees_updated INTEGER,
    discounts_forfeited INTEGER
) AS $$
DECLARE
    v_fees_updated INTEGER := 0;
    v_discounts_forfeited INTEGER := 0;
    v_fee RECORD;
    v_settings RECORD;
    v_late_fee DECIMAL(10,2);
    v_days_overdue INTEGER;
BEGIN
    -- Loop through all schools with fee settings
    FOR v_settings IN 
        SELECT * FROM fee_settings WHERE enable_late_fees = true
    LOOP
        -- Find overdue fees for this school
        FOR v_fee IN
            SELECT sf.* 
            FROM student_fees sf
            WHERE sf.school_id = v_settings.school_id
              AND sf.status IN ('pending', 'partial')
              AND sf.due_date < CURRENT_DATE
              AND sf.due_date + v_settings.grace_days < CURRENT_DATE
              AND sf.late_fee_applied = 0  -- Not already applied
        LOOP
            -- Calculate days overdue (after grace period)
            v_days_overdue := CURRENT_DATE - (v_fee.due_date + v_settings.grace_days);
            
            -- Calculate late fee
            IF v_settings.late_fee_type = 'percentage' THEN
                v_late_fee := (v_fee.final_amount * v_settings.late_fee_value) / 100;
            ELSE
                v_late_fee := v_settings.late_fee_value;
            END IF;
            
            -- Apply late fee and update status
            UPDATE student_fees
            SET 
                late_fee_applied = v_late_fee,
                final_amount = final_amount + v_late_fee,
                status = 'overdue',
                updated_at = NOW(),
                notes = COALESCE(notes, '') || ' | Late fee applied: ' || v_late_fee::TEXT || ' on ' || CURRENT_DATE::TEXT
            WHERE id = v_fee.id;
            
            v_fees_updated := v_fees_updated + 1;
            
            -- Forfeit discount if enabled
            IF v_settings.discount_forfeiture_enabled AND NOT v_fee.discount_forfeited THEN
                UPDATE student_fees
                SET discount_forfeited = true
                WHERE id = v_fee.id;
                
                v_discounts_forfeited := v_discounts_forfeited + 1;
            END IF;
        END LOOP;
    END LOOP;
    
    RETURN QUERY SELECT v_fees_updated, v_discounts_forfeited;
END;
$$ LANGUAGE plpgsql;

-- Function to apply late fees for a specific school (for manual trigger)
CREATE OR REPLACE FUNCTION apply_late_fees_for_school(p_school_id UUID)
RETURNS TABLE(
    fees_updated INTEGER,
    discounts_forfeited INTEGER
) AS $$
DECLARE
    v_fees_updated INTEGER := 0;
    v_discounts_forfeited INTEGER := 0;
    v_fee RECORD;
    v_settings RECORD;
    v_late_fee DECIMAL(10,2);
BEGIN
    -- Get settings for this school
    SELECT * INTO v_settings 
    FROM fee_settings 
    WHERE school_id = p_school_id AND enable_late_fees = true;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT 0, 0;
        RETURN;
    END IF;
    
    -- Find overdue fees
    FOR v_fee IN
        SELECT sf.* 
        FROM student_fees sf
        WHERE sf.school_id = p_school_id
          AND sf.status IN ('pending', 'partial')
          AND sf.due_date < CURRENT_DATE
          AND sf.due_date + v_settings.grace_days < CURRENT_DATE
          AND sf.late_fee_applied = 0
    LOOP
        -- Calculate late fee
        IF v_settings.late_fee_type = 'percentage' THEN
            v_late_fee := (v_fee.final_amount * v_settings.late_fee_value) / 100;
        ELSE
            v_late_fee := v_settings.late_fee_value;
        END IF;
        
        -- Apply late fee
        UPDATE student_fees
        SET 
            late_fee_applied = v_late_fee,
            final_amount = final_amount + v_late_fee,
            status = 'overdue',
            updated_at = NOW()
        WHERE id = v_fee.id;
        
        v_fees_updated := v_fees_updated + 1;
        
        -- Forfeit discount if enabled
        IF v_settings.discount_forfeiture_enabled AND NOT v_fee.discount_forfeited THEN
            UPDATE student_fees SET discount_forfeited = true WHERE id = v_fee.id;
            v_discounts_forfeited := v_discounts_forfeited + 1;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT v_fees_updated, v_discounts_forfeited;
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- OPTIONAL: Enable pg_cron for automatic execution
-- Uncomment if pg_cron extension is available
-- =========================================

-- SELECT cron.schedule(
--     'apply-late-fees-daily',
--     '0 2 * * *',  -- Run at 2 AM daily
--     $$SELECT apply_late_fees()$$
-- );

COMMENT ON FUNCTION apply_late_fees IS 'Applies late fees to all overdue student_fees across all schools. Run daily via cron.';
COMMENT ON FUNCTION apply_late_fees_for_school IS 'Applies late fees for a specific school. Can be triggered manually by admin.';

SELECT 'Late Fee Automation functions created successfully!' AS status;
