-- =====================================================
-- School Services & Student Service Subscriptions
-- Supports grade-level specific pricing
-- =====================================================

-- Drop existing tables if re-running
DROP TABLE IF EXISTS student_services CASCADE;
DROP TABLE IF EXISTS service_grade_charges CASCADE;
DROP TABLE IF EXISTS school_services CASCADE;

-- School-defined services (Bus, Meals, Sports, Lab, etc.)
CREATE TABLE school_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    description TEXT,
    service_type VARCHAR(20) DEFAULT 'recurring' CHECK (service_type IN ('recurring', 'one_time')),
    charge_frequency VARCHAR(20) DEFAULT 'monthly' CHECK (charge_frequency IN ('monthly', 'quarterly', 'yearly', 'one_time')),
    default_charge DECIMAL(12,2) NOT NULL DEFAULT 0,
    is_mandatory BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, code)
);

-- Grade-level specific charges (optional - overrides default_charge)
CREATE TABLE service_grade_charges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES school_services(id) ON DELETE CASCADE,
    grade_level_id UUID NOT NULL REFERENCES grade_levels(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    charge_amount DECIMAL(12,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(service_id, grade_level_id)
);

-- Student service subscriptions
CREATE TABLE student_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES school_services(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    custom_charge DECIMAL(12,2),  -- Optional override for specific student
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, service_id)
);

-- Indexes for performance
CREATE INDEX idx_school_services_school ON school_services(school_id);
CREATE INDEX idx_school_services_active ON school_services(school_id, is_active);
CREATE INDEX idx_service_grade_charges_service ON service_grade_charges(service_id);
CREATE INDEX idx_service_grade_charges_grade ON service_grade_charges(grade_level_id);
CREATE INDEX idx_student_services_student ON student_services(student_id);
CREATE INDEX idx_student_services_service ON student_services(service_id);
CREATE INDEX idx_student_services_active ON student_services(student_id, is_active);

-- =====================================================
-- Helper function to get service charge for a student
-- Returns: grade-specific charge OR custom charge OR default charge
-- =====================================================
CREATE OR REPLACE FUNCTION get_student_service_charge(
    p_student_id UUID,
    p_service_id UUID
) RETURNS DECIMAL(12,2) AS $$
DECLARE
    v_charge DECIMAL(12,2);
    v_grade_level_id UUID;
    v_custom_charge DECIMAL(12,2);
BEGIN
    -- Check for custom charge first
    SELECT custom_charge INTO v_custom_charge
    FROM student_services
    WHERE student_id = p_student_id AND service_id = p_service_id AND is_active = true;
    
    IF v_custom_charge IS NOT NULL THEN
        RETURN v_custom_charge;
    END IF;
    
    -- Get student's grade level
    SELECT grade_level_id INTO v_grade_level_id
    FROM students WHERE id = p_student_id;
    
    -- Try grade-specific charge
    IF v_grade_level_id IS NOT NULL THEN
        SELECT charge_amount INTO v_charge
        FROM service_grade_charges
        WHERE service_id = p_service_id AND grade_level_id = v_grade_level_id AND is_active = true;
        
        IF v_charge IS NOT NULL THEN
            RETURN v_charge;
        END IF;
    END IF;
    
    -- Fall back to default charge
    SELECT default_charge INTO v_charge
    FROM school_services WHERE id = p_service_id;
    
    RETURN COALESCE(v_charge, 0);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Function to calculate total service charges for a student
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_student_services_total(
    p_student_id UUID
) RETURNS DECIMAL(12,2) AS $$
DECLARE
    v_total DECIMAL(12,2) := 0;
    v_service RECORD;
BEGIN
    FOR v_service IN 
        SELECT service_id FROM student_services 
        WHERE student_id = p_student_id AND is_active = true
    LOOP
        v_total := v_total + get_student_service_charge(p_student_id, v_service.service_id);
    END LOOP;
    
    RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- RLS Policies
-- =====================================================
ALTER TABLE school_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_grade_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_services ENABLE ROW LEVEL SECURITY;

-- School services policies
CREATE POLICY school_services_select ON school_services FOR SELECT
    USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY school_services_insert ON school_services FOR INSERT
    WITH CHECK (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

CREATE POLICY school_services_update ON school_services FOR UPDATE
    USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

CREATE POLICY school_services_delete ON school_services FOR DELETE
    USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Service grade charges policies
CREATE POLICY service_grade_charges_select ON service_grade_charges FOR SELECT
    USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY service_grade_charges_all ON service_grade_charges FOR ALL
    USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Student services policies
CREATE POLICY student_services_select ON student_services FOR SELECT
    USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY student_services_all ON student_services FOR ALL
    USING (school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Grant parent access to view their children's services
CREATE POLICY student_services_parent ON student_services FOR SELECT
    USING (
        student_id IN (
            SELECT psl.student_id FROM parent_student_links psl
            JOIN parents p ON p.id = psl.parent_id
            WHERE p.profile_id = auth.uid() AND psl.is_active = true
        )
    );
