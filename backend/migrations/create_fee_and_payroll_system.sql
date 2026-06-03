-- =========================================
-- FEE MANAGEMENT & PAYROLL SYSTEM
-- Run this in Supabase SQL Editor
-- =========================================

-- Check required tables exist first
DO $$
BEGIN
    -- Verify schools table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schools') THEN
        RAISE EXCEPTION 'Required table "schools" does not exist. Please run base migrations first.';
    END IF;
    
    -- Verify profiles table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
        RAISE EXCEPTION 'Required table "profiles" does not exist. Please run base migrations first.';
    END IF;
    
    -- Verify students table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'students') THEN
        RAISE EXCEPTION 'Required table "students" does not exist. Please run base migrations first.';
    END IF;
    
    -- Verify staff table exists (for payroll)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff') THEN
        RAISE EXCEPTION 'Required table "staff" does not exist. Please run base migrations first.';
    END IF;
    
    -- Verify parent_student_links table exists (for sibling discounts)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'parent_student_links') THEN
        RAISE EXCEPTION 'Required table "parent_student_links" does not exist. Please run base migrations first.';
    END IF;
    
    RAISE NOTICE 'All required tables exist. Proceeding with migration...';
END $$;

-- ==========================================
-- CLEANUP: Drop tables if they exist (for re-running migration)
-- Run this ONLY if you had a failed migration before
-- ==========================================

-- Drop in reverse dependency order
DROP TABLE IF EXISTS salary_allowance_items CASCADE;
DROP TABLE IF EXISTS salary_deduction_items CASCADE;
DROP TABLE IF EXISTS salary_records CASCADE;
DROP TABLE IF EXISTS salary_advances CASCADE;
DROP TABLE IF EXISTS staff_attendance CASCADE;
DROP TABLE IF EXISTS salary_structures CASCADE;
DROP TABLE IF EXISTS payroll_settings CASCADE;
DROP TABLE IF EXISTS fee_payments CASCADE;
DROP TABLE IF EXISTS student_fees CASCADE;
DROP TABLE IF EXISTS fee_structures CASCADE;
DROP TABLE IF EXISTS discount_rules CASCADE;
DROP TABLE IF EXISTS sibling_discount_tiers CASCADE;
DROP TABLE IF EXISTS fee_categories CASCADE;
DROP TABLE IF EXISTS fee_settings CASCADE;

-- ==========================================
-- PART 1: FEE MANAGEMENT TABLES
-- ==========================================

-- Centralized Fee Settings (per school - admin configurable)
CREATE TABLE IF NOT EXISTS fee_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Deadline & Late Fee Settings
    enable_late_fees BOOLEAN DEFAULT true,
    late_fee_type VARCHAR(10) DEFAULT 'percentage' CHECK (late_fee_type IN ('percentage', 'fixed')),
    late_fee_value DECIMAL(10,2) DEFAULT 5.00,
    grace_days INTEGER DEFAULT 7,
    
    -- Discount Settings
    enable_sibling_discounts BOOLEAN DEFAULT true,
    discount_forfeiture_enabled BOOLEAN DEFAULT true,
    admin_can_restore_discounts BOOLEAN DEFAULT true,
    
    -- Payment Settings
    allow_partial_payments BOOLEAN DEFAULT true,
    min_partial_payment_percent DECIMAL(5,2) DEFAULT 25.00,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id)
);

-- Fee Categories (tuition, bus, books, etc.)
CREATE TABLE IF NOT EXISTS fee_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    description TEXT,
    is_mandatory BOOLEAN DEFAULT true,
    is_discountable BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, code)
);

-- Sibling Discount Tiers (admin configurable)
CREATE TABLE IF NOT EXISTS sibling_discount_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    sibling_count INTEGER NOT NULL,
    discount_type VARCHAR(10) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(10,2) NOT NULL,
    applies_to_categories UUID[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, sibling_count)
);

-- Custom Discount Rules (early bird, full year, etc.)
CREATE TABLE IF NOT EXISTS discount_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    discount_type VARCHAR(10) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(10,2) NOT NULL,
    applies_to_categories UUID[] DEFAULT '{}',
    valid_from DATE,
    valid_to DATE,
    requires_on_time_payment BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fee Structure (per grade, per category, per period)
CREATE TABLE IF NOT EXISTS fee_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year VARCHAR(20) NOT NULL,
    grade_level_id UUID REFERENCES grade_levels(id) ON DELETE SET NULL,
    fee_category_id UUID NOT NULL REFERENCES fee_categories(id) ON DELETE CASCADE,
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('monthly', 'semester', 'annual', 'one_time')),
    period_name VARCHAR(50),
    period_number INTEGER,
    amount DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student Fee Records (generated fees per student)
CREATE TABLE IF NOT EXISTS student_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    fee_structure_id UUID NOT NULL REFERENCES fee_structures(id) ON DELETE CASCADE,
    academic_year VARCHAR(20) NOT NULL,
    base_amount DECIMAL(10,2) NOT NULL,
    sibling_discount DECIMAL(10,2) DEFAULT 0,
    custom_discount DECIMAL(10,2) DEFAULT 0,
    discount_rule_id UUID REFERENCES discount_rules(id),
    late_fee_applied DECIMAL(10,2) DEFAULT 0,
    final_amount DECIMAL(10,2) NOT NULL,
    amount_paid DECIMAL(10,2) DEFAULT 0,
    balance DECIMAL(10,2) GENERATED ALWAYS AS (final_amount - amount_paid) STORED,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue', 'waived')),
    due_date DATE NOT NULL,
    discount_forfeited BOOLEAN DEFAULT false,
    discount_restored_by UUID REFERENCES profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fee Payments
CREATE TABLE IF NOT EXISTS fee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_fee_id UUID NOT NULL REFERENCES student_fees(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'cash',
    payment_reference VARCHAR(100),
    payment_date TIMESTAMPTZ DEFAULT NOW(),
    received_by UUID REFERENCES profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- PART 2: PAYROLL & SALARY TABLES
-- ==========================================

-- Payroll Settings (per school - admin configurable)
CREATE TABLE IF NOT EXISTS payroll_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    
    -- Attendance Deduction Rules
    grace_late_count INTEGER DEFAULT 3,
    late_threshold_minutes INTEGER DEFAULT 15,
    deduction_type VARCHAR(15) DEFAULT 'per_minute' CHECK (deduction_type IN ('percentage', 'fixed', 'per_minute')),
    deduction_value DECIMAL(10,2) DEFAULT 1.00,
    absence_deduction_percent DECIMAL(5,2) DEFAULT 100,
    
    -- Attendance Bonus
    attendance_bonus_enabled BOOLEAN DEFAULT false,
    attendance_bonus_amount DECIMAL(12,2) DEFAULT 0,
    
    -- Advance Settings
    max_advance_percent DECIMAL(5,2) DEFAULT 50,
    
    -- Working Hours
    expected_check_in TIME DEFAULT '08:00',
    working_days_per_month INTEGER DEFAULT 22,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id)
);

-- Staff Salary Structure
CREATE TABLE IF NOT EXISTS salary_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    base_salary DECIMAL(12,2) NOT NULL,
    allowances JSONB DEFAULT '{}',
    fixed_deductions JSONB DEFAULT '{}',
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_current BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff Attendance (for payroll deductions)
CREATE TABLE IF NOT EXISTS staff_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    check_in_time TIME,
    check_out_time TIME,
    expected_time TIME NOT NULL,
    late_minutes INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused', 'half_day', 'leave')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(staff_id, attendance_date)
);

-- Salary Advance Requests
CREATE TABLE IF NOT EXISTS salary_advances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    reason TEXT,
    request_date TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'recovered')),
    approved_by UUID REFERENCES profiles(id),
    approved_date TIMESTAMPTZ,
    recovery_month INTEGER,
    recovery_year INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly Salary Records
CREATE TABLE IF NOT EXISTS salary_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    salary_structure_id UUID REFERENCES salary_structures(id),
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    base_salary DECIMAL(12,2) NOT NULL,
    total_allowances DECIMAL(12,2) DEFAULT 0,
    attendance_bonus DECIMAL(12,2) DEFAULT 0,
    total_deductions DECIMAL(12,2) DEFAULT 0,
    advance_deduction DECIMAL(12,2) DEFAULT 0,
    net_salary DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
    payment_date TIMESTAMPTZ,
    payment_method VARCHAR(50),
    payment_reference VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(staff_id, month, year)
);

-- Salary Deduction Items (for pay slip breakdown)
CREATE TABLE IF NOT EXISTS salary_deduction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salary_record_id UUID NOT NULL REFERENCES salary_records(id) ON DELETE CASCADE,
    deduction_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    deduction_date DATE,
    reference_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Salary Allowance Items (for pay slip breakdown)
CREATE TABLE IF NOT EXISTS salary_allowance_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salary_record_id UUID NOT NULL REFERENCES salary_records(id) ON DELETE CASCADE,
    allowance_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- PART 3: INDEXES FOR PERFORMANCE
-- ==========================================

-- Fee indexes
CREATE INDEX IF NOT EXISTS idx_fee_categories_school ON fee_categories(school_id, is_active);
CREATE INDEX IF NOT EXISTS idx_fee_structures_school ON fee_structures(school_id, academic_year, is_active);
CREATE INDEX IF NOT EXISTS idx_fee_structures_grade ON fee_structures(grade_level_id, is_active);
CREATE INDEX IF NOT EXISTS idx_student_fees_student ON student_fees(student_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_student_fees_status ON student_fees(school_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_student_fees_school_year ON student_fees(school_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_fee_payments_student_fee ON fee_payments(student_fee_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_date ON fee_payments(school_id, payment_date);

-- Salary indexes
CREATE INDEX IF NOT EXISTS idx_salary_structures_staff ON salary_structures(staff_id, is_current);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff ON staff_attendance(staff_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_month ON staff_attendance(school_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_salary_records_staff ON salary_records(staff_id, year, month);
CREATE INDEX IF NOT EXISTS idx_salary_records_status ON salary_records(school_id, status, year, month);
CREATE INDEX IF NOT EXISTS idx_salary_advances_staff ON salary_advances(staff_id, status);

-- ==========================================
-- PART 4: HELPER FUNCTIONS
-- ==========================================

-- Function to count siblings via parent_student_links
CREATE OR REPLACE FUNCTION count_siblings(p_student_id UUID, p_school_id UUID)
RETURNS INTEGER AS $$
DECLARE
    sibling_count INTEGER;
BEGIN
    SELECT COUNT(DISTINCT psl2.student_id)
    INTO sibling_count
    FROM parent_student_links psl1
    INNER JOIN parent_student_links psl2 ON psl1.parent_id = psl2.parent_id
    INNER JOIN students s ON psl2.student_id = s.id
    WHERE psl1.student_id = p_student_id
      AND psl1.is_active = true
      AND psl2.is_active = true
      AND s.school_id = p_school_id;
    
    RETURN COALESCE(sibling_count, 1);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get sibling discount for a student
CREATE OR REPLACE FUNCTION get_sibling_discount(
    p_student_id UUID,
    p_school_id UUID,
    p_fee_category_id UUID,
    p_base_amount DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
    v_sibling_count INTEGER;
    v_discount_type VARCHAR(10);
    v_discount_value DECIMAL(10,2);
    v_discount DECIMAL(10,2) := 0;
BEGIN
    -- Count siblings
    v_sibling_count := count_siblings(p_student_id, p_school_id);
    
    -- Get applicable discount tier
    SELECT discount_type, discount_value
    INTO v_discount_type, v_discount_value
    FROM sibling_discount_tiers
    WHERE school_id = p_school_id
      AND sibling_count = v_sibling_count
      AND is_active = true
      AND (applies_to_categories = '{}' OR p_fee_category_id = ANY(applies_to_categories));
    
    IF FOUND THEN
        IF v_discount_type = 'percentage' THEN
            v_discount := (p_base_amount * v_discount_value) / 100;
        ELSE
            v_discount := v_discount_value;
        END IF;
    END IF;
    
    RETURN COALESCE(v_discount, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger to update student_fees.updated_at
CREATE OR REPLACE FUNCTION update_student_fees_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_student_fees_timestamp ON student_fees;
CREATE TRIGGER update_student_fees_timestamp
    BEFORE UPDATE ON student_fees
    FOR EACH ROW
    EXECUTE FUNCTION update_student_fees_timestamp();

-- Trigger to update amount_paid and status after payment
CREATE OR REPLACE FUNCTION update_fee_after_payment()
RETURNS TRIGGER AS $$
DECLARE
    v_total_paid DECIMAL(10,2);
    v_final_amount DECIMAL(10,2);
BEGIN
    -- Calculate total paid for this fee
    SELECT COALESCE(SUM(amount), 0), sf.final_amount
    INTO v_total_paid, v_final_amount
    FROM fee_payments fp
    INNER JOIN student_fees sf ON fp.student_fee_id = sf.id
    WHERE fp.student_fee_id = NEW.student_fee_id
    GROUP BY sf.final_amount;
    
    -- Update student_fees
    UPDATE student_fees
    SET 
        amount_paid = v_total_paid,
        status = CASE 
            WHEN v_total_paid >= v_final_amount THEN 'paid'
            WHEN v_total_paid > 0 THEN 'partial'
            ELSE 'pending'
        END,
        updated_at = NOW()
    WHERE id = NEW.student_fee_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_fee_after_payment ON fee_payments;
CREATE TRIGGER update_fee_after_payment
    AFTER INSERT ON fee_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_fee_after_payment();

-- ==========================================
-- PART 5: ROW LEVEL SECURITY
-- ==========================================

-- Enable RLS
ALTER TABLE fee_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sibling_discount_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_deduction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_allowance_items ENABLE ROW LEVEL SECURITY;

-- Admin policies for fee tables
CREATE POLICY fee_settings_admin ON fee_settings FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
        AND (role = 'super_admin' OR school_id = fee_settings.school_id)
    ));

CREATE POLICY fee_categories_admin ON fee_categories FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
        AND (role = 'super_admin' OR school_id = fee_categories.school_id)
    ));

CREATE POLICY sibling_discount_tiers_admin ON sibling_discount_tiers FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
        AND (role = 'super_admin' OR school_id = sibling_discount_tiers.school_id)
    ));

CREATE POLICY discount_rules_admin ON discount_rules FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
        AND (role = 'super_admin' OR school_id = discount_rules.school_id)
    ));

CREATE POLICY fee_structures_admin ON fee_structures FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
        AND (role = 'super_admin' OR school_id = fee_structures.school_id)
    ));

CREATE POLICY student_fees_admin ON student_fees FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
        AND (role = 'super_admin' OR school_id = student_fees.school_id)
    ));

CREATE POLICY fee_payments_admin ON fee_payments FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
        AND (role = 'super_admin' OR school_id = fee_payments.school_id)
    ));

-- Admin policies for payroll tables
CREATE POLICY payroll_settings_admin ON payroll_settings FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
        AND (role = 'super_admin' OR school_id = payroll_settings.school_id)
    ));

CREATE POLICY salary_structures_admin ON salary_structures FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
        AND (role = 'super_admin' OR school_id = salary_structures.school_id)
    ));

CREATE POLICY staff_attendance_admin ON staff_attendance FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
        AND (role = 'super_admin' OR school_id = staff_attendance.school_id)
    ));

CREATE POLICY salary_advances_admin ON salary_advances FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
        AND (role = 'super_admin' OR school_id = salary_advances.school_id)
    ));

CREATE POLICY salary_records_admin ON salary_records FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
        AND (role = 'super_admin' OR school_id = salary_records.school_id)
    ));

CREATE POLICY salary_deduction_items_admin ON salary_deduction_items FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles p
        INNER JOIN salary_records sr ON sr.id = salary_deduction_items.salary_record_id
        WHERE p.id = auth.uid() 
        AND p.role IN ('admin', 'super_admin')
        AND (p.role = 'super_admin' OR p.school_id = sr.school_id)
    ));

CREATE POLICY salary_allowance_items_admin ON salary_allowance_items FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles p
        INNER JOIN salary_records sr ON sr.id = salary_allowance_items.salary_record_id
        WHERE p.id = auth.uid() 
        AND p.role IN ('admin', 'super_admin')
        AND (p.role = 'super_admin' OR p.school_id = sr.school_id)
    ));

-- Teacher can view own salary records
CREATE POLICY salary_records_teacher_read ON salary_records FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM staff s
        INNER JOIN profiles p ON s.profile_id = p.id
        WHERE p.id = auth.uid()
        AND s.id = salary_records.staff_id
    ));

CREATE POLICY salary_advances_teacher_read ON salary_advances FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM staff s
        INNER JOIN profiles p ON s.profile_id = p.id
        WHERE p.id = auth.uid()
        AND s.id = salary_advances.staff_id
    ));

-- Teacher can create advance requests
CREATE POLICY salary_advances_teacher_insert ON salary_advances FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM staff s
        INNER JOIN profiles p ON s.profile_id = p.id
        WHERE p.id = auth.uid()
        AND s.id = salary_advances.staff_id
    ));

-- Parent can view own children's fees
CREATE POLICY student_fees_parent_read ON student_fees FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM parent_student_links psl
        INNER JOIN parents par ON psl.parent_id = par.id
        INNER JOIN profiles p ON par.profile_id = p.id
        WHERE p.id = auth.uid()
        AND psl.student_id = student_fees.student_id
        AND psl.is_active = true
    ));

-- ==========================================
-- PART 6: COMMENTS
-- ==========================================

COMMENT ON TABLE fee_settings IS 'Centralized fee configuration per school - all settings admin configurable';
COMMENT ON TABLE fee_categories IS 'Fee types like tuition, bus, books - each can have discount applicability toggled';
COMMENT ON TABLE sibling_discount_tiers IS 'Admin-defined discount tiers based on number of siblings';
COMMENT ON TABLE student_fees IS 'Generated fee records per student with automatic balance calculation';
COMMENT ON TABLE payroll_settings IS 'Centralized payroll configuration per school - attendance rules, bonuses, etc';
COMMENT ON TABLE salary_advances IS 'Staff salary advance requests with auto-recovery tracking';
COMMENT ON FUNCTION count_siblings IS 'Counts active siblings in same school via parent_student_links';
COMMENT ON FUNCTION get_sibling_discount IS 'Calculates sibling discount based on school tier configuration';

-- Done!
SELECT 'Fee Management & Payroll System migration completed successfully!' AS status;
