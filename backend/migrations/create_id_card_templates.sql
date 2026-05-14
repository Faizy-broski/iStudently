-- Migration: Create ID Card Templates System
-- Description: Allows schools to create customizable ID card templates for students, teachers, and staff

-- Create id_card_templates table
CREATE TABLE IF NOT EXISTS id_card_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campus_id UUID NOT NULL REFERENCES campuses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    user_type VARCHAR(50) NOT NULL CHECK (user_type IN ('student', 'teacher', 'staff')),
    
    -- Template configuration stored as JSON
    -- Structure: {
    --   fields: [{id, label, token, position: {x, y}, size: {width, height}, style: {fontSize, fontWeight, color, align}}],
    --   layout: {width, height, orientation: 'portrait'|'landscape'},
    --   design: {backgroundColor, borderColor, borderWidth, borderRadius, backgroundImage},
    --   qrCode: {enabled, position, size, data: 'template with tokens'}
    -- }
    template_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Only one active template per school per user type
    is_active BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    
    -- Ensure unique active template per campus and user type
    CONSTRAINT unique_active_template UNIQUE (campus_id, user_type, is_active) 
    WHERE is_active = true
);

-- Create indexes
CREATE INDEX idx_id_card_templates_campus_id ON id_card_templates(campus_id);
CREATE INDEX idx_id_card_templates_user_type ON id_card_templates(user_type);
CREATE INDEX idx_id_card_templates_active ON id_card_templates(campus_id, user_type, is_active) WHERE is_active = true;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_id_card_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_id_card_templates_updated_at
    BEFORE UPDATE ON id_card_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_id_card_templates_updated_at();

-- Insert default templates for each user type
-- These provide sensible defaults that schools can customize

-- Default Student ID Card Template
INSERT INTO id_card_templates (campus_id, name, description, user_type, template_config, is_active)
SELECT 
    id as campus_id,
    'Default Student ID Card',
    'Standard student ID card with photo, name, ID number, section, and campus',
    'student',
    jsonb_build_object(
        'fields', jsonb_build_array(
            jsonb_build_object('id', 'campus_header', 'label', 'Campus Name', 'token', '{{campus_name}}', 'type', 'text', 'position', jsonb_build_object('x', 20, 'y', 20), 'size', jsonb_build_object('width', 260, 'height', 25), 'style', jsonb_build_object('fontSize', 16, 'fontWeight', 'bold', 'color', '#3b82f6', 'align', 'center')),
            jsonb_build_object('id', 'school_name', 'label', 'School Name', 'token', '{{school_name}}', 'type', 'text', 'position', jsonb_build_object('x', 20, 'y', 50), 'size', jsonb_build_object('width', 260, 'height', 20), 'style', jsonb_build_object('fontSize', 12, 'fontWeight', 'normal', 'color', '#6b7280', 'align', 'center')),
            jsonb_build_object('id', 'photo', 'label', 'Photo', 'token', '{{photo_url}}', 'type', 'image', 'position', jsonb_build_object('x', 20, 'y', 80), 'size', jsonb_build_object('width', 120, 'height', 120)),
            jsonb_build_object('id', 'name', 'label', 'Student Name', 'token', '{{first_name}} {{last_name}}', 'type', 'text', 'position', jsonb_build_object('x', 20, 'y', 220), 'size', jsonb_build_object('width', 260, 'height', 30), 'style', jsonb_build_object('fontSize', 20, 'fontWeight', 'bold', 'color', '#1f2937', 'align', 'center')),
            jsonb_build_object('id', 'student_id', 'label', 'Student ID', 'token', 'ID: {{student_id}}', 'type', 'text', 'position', jsonb_build_object('x', 20, 'y', 260), 'size', jsonb_build_object('width', 260, 'height', 20), 'style', jsonb_build_object('fontSize', 14, 'fontWeight', 'normal', 'color', '#4b5563', 'align', 'center')),
            jsonb_build_object('id', 'section', 'label', 'Section', 'token', '{{section}} - {{grade_level}}', 'type', 'text', 'position', jsonb_build_object('x', 20, 'y', 290), 'size', jsonb_build_object('width', 260, 'height', 20), 'style', jsonb_build_object('fontSize', 14, 'fontWeight', 'normal', 'color', '#4b5563', 'align', 'center')),
            jsonb_build_object('id', 'admission_date', 'label', 'Admission Date', 'token', 'Admitted: {{admission_date}}', 'type', 'text', 'position', jsonb_build_object('x', 20, 'y', 320), 'size', jsonb_build_object('width', 260, 'height', 20), 'style', jsonb_build_object('fontSize', 12, 'fontWeight', 'normal', 'color', '#6b7280', 'align', 'center')),
            jsonb_build_object('id', 'contact', 'label', 'Contact', 'token', '{{phone}}', 'type', 'text', 'position', jsonb_build_object('x', 20, 'y', 350), 'size', jsonb_build_object('width', 260, 'height', 20), 'style', jsonb_build_object('fontSize', 12, 'fontWeight', 'normal', 'color', '#6b7280', 'align', 'center'))
        ),
        'layout', jsonb_build_object('width', 300, 'height', 480, 'orientation', 'portrait'),
        'design', jsonb_build_object('backgroundColor', '#ffffff', 'borderColor', '#3b82f6', 'borderWidth', 3, 'borderRadius', 12),
        'qrCode', jsonb_build_object('enabled', true, 'position', jsonb_build_object('x', 100, 'y', 420), 'size', 100, 'data', '{{student_id}}')
    ),
    true
FROM campuses
WHERE NOT EXISTS (
    SELECT 1 FROM id_card_templates 
    WHERE campus_id = campuses.id AND user_type = 'student'
);

-- Default Teacher ID Card Template
INSERT INTO id_card_templates (campus_id, name, description, user_type, template_config, is_active)
SELECT 
    id as campus_id,
    'Default Teacher ID Card',
    'Standard teacher ID card with photo, name, employee ID, department, and campus',
    'teacher',
    jsonb_build_object(
        'fields', jsonb_build_array(
            jsonb_build_object('id', 'campus_header', 'label', 'Campus Name', 'token', '{{campus_name}}', 'type', 'text', 'position', jsonb_build_object('x', 20, 'y', 20), 'size', jsonb_build_object('width', 260, 'height', 25), 'style', jsonb_build_object('fontSize', 16, 'fontWeight', 'bold', 'color', '#10b981', 'align', 'center')),
            jsonb_build_object('id', 'school_name', 'label', 'School Name', 'token', '{{school_name}}', 'type', 'text', 'position', jsonb_build_object('x', 20, 'y', 50), 'size', jsonb_build_object('width', 260, 'height', 20), 'style', jsonb_build_object('fontSize', 12, 'fontWeight', 'normal', 'color', '#6b7280', 'align', 'center')),
            jsonb_build_object('id', 'photo', 'label', 'Photo', 'token', '{{photo_url}}', 'type', 'image', 'position', jsonb_build_object('x', 20, 'y', 80), 'size', jsonb_build_object('width', 120, 'height', 120)),
            jsonb_build_object('id', 'name', 'label', 'Teacher Name', 'token', '{{first_name}} {{last_name}}', 'type', 'text', 'position', jsonb_build_object('x', 20, 'y', 220), 'size', jsonb_build_object('width', 260, 'height', 30), 'style', jsonb_build_object('fontSize', 20, 'fontWeight', 'bold', 'color', '#1f2937', 'align', 'center')),
            jsonb_build_object('id', 'designation', 'label', 'Designation', 'token', '{{designation}}', 'type', 'text', 'position', jsonb_build_object('x', 20, 'y', 260), 'size', jsonb_build_object('width', 260, 'height', 20), 'style', jsonb_build_object('fontSize', 14, 'fontWeight', 'normal', 'color', '#4b5563', 'align', 'center')),
            jsonb_build_object('id', 'employee_id', 'label', 'Employee ID', 'token', 'EMP ID: {{employee_id}}', 'type', 'text', 'position', jsonb_build_object('x', 20, 'y', 290), 'size', jsonb_build_object('width', 260, 'height', 20), 'style', jsonb_build_object('fontSize', 14, 'fontWeight', 'normal', 'color', '#4b5563', 'align', 'center')),
            jsonb_build_object('id', 'department', 'label', 'Department', 'token', 'Dept: {{department}}', 'type', 'text', 'position', jsonb_build_object('x', 20, 'y', 320), 'size', jsonb_build_object('width', 260, 'height', 20), 'style', jsonb_build_object('fontSize', 12, 'fontWeight', 'normal', 'color', '#6b7280', 'align', 'center')),
            jsonb_build_object('id', 'contact', 'label', 'Contact', 'token', '{{phone}} | {{email}}', 'type', 'text', 'position', jsonb_build_object('x', 20, 'y', 350), 'size', jsonb_build_object('width', 260, 'height', 20), 'style', jsonb_build_object('fontSize', 11, 'fontWeight', 'normal', 'color', '#6b7280', 'align', 'center'))
        ),
        'layout', jsonb_build_object('width', 300, 'height', 480, 'orientation', 'portrait'),
        'design', jsonb_build_object('backgroundColor', '#ffffff', 'borderColor', '#10b981', 'borderWidth', 3, 'borderRadius', 12),
        'qrCode', jsonb_build_object('enabled', true, 'position', jsonb_build_object('x', 100, 'y', 420), 'size', 100, 'data', '{{employee_id}}')
    ),
    true
FROM campuses
WHERE NOT EXISTS (
    SELECT 1 FROM id_card_templates 
    WHERE campus_id = campuses.id AND user_type = 'teacher'
);

-- Default Staff ID Card Template
INSERT INTO id_card_templates (campus_id, name, description, user_type, template_config, is_active)
SELECT 
    id as campus_id,
    'Default Staff ID Card',
    'Standard staff ID card with photo, name, employee ID, role, and campus',
    'staff',
    jsonb_build_object(
        'fields', jsonb_build_array(
            jsonb_build_object('id', 'campus_header', 'label', 'Campus Name', 'token', '{{campus_name}}', 'type', 'text', 'position', jsonb_build_object('x', 20, 'y', 20), 'size', jsonb_build_object('width', 260, 'height', 25), 'style', jsonb_build_object('fontSize', 16, 'fontWeight', 'bold', 'color', '#f59e0b', 'align', 'center')),
            jsonb_build_object('id', 'school_name', 'label', 'School Name', 'token', '{{school_name}}', 'type', 'text', 'position', jsonb_build_object('x', 20, 'y', 50), 'size', jsonb_build_object('width', 260, 'height', 20), 'style', jsonb_build_object('fontSize', 12, 'fontWeight', 'normal', 'color', '#6b7280', 'align', 'center')),
            jsonb_build_object('id', 'photo', 'label', 'Photo', 'token', '{{photo_url}}', 'type', 'image', 'position', jsonb_build_object('x', 20, 'y', 80), 'size', jsonb_build_object('width', 120, 'height', 120)),
            jsonb_build_object('id', 'name', 'label', 'Staff Name', 'token', '{{first_name}} {{last_name}}', 'type', 'text', 'position', jsonb_build_object('x', 20, 'y', 220), 'size', jsonb_build_object('width', 260, 'height', 30), 'style', jsonb_build_object('fontSize', 20, 'fontWeight', 'bold', 'color', '#1f2937', 'align', 'center')),
            jsonb_build_object('id', 'role', 'label', 'Role', 'token', '{{role}}', 'type', 'text', 'position', jsonb_build_object('x', 20, 'y', 260), 'size', jsonb_build_object('width', 260, 'height', 20), 'style', jsonb_build_object('fontSize', 14, 'fontWeight', 'normal', 'color', '#4b5563', 'align', 'center')),
            jsonb_build_object('id', 'employee_id', 'label', 'Employee ID', 'token', 'EMP ID: {{employee_id}}', 'type', 'text', 'position', jsonb_build_object('x', 20, 'y', 290), 'size', jsonb_build_object('width', 260, 'height', 20), 'style', jsonb_build_object('fontSize', 14, 'fontWeight', 'normal', 'color', '#4b5563', 'align', 'center')),
            jsonb_build_object('id', 'department', 'label', 'Department', 'token', 'Dept: {{department}}', 'type', 'text', 'position', jsonb_build_object('x', 20, 'y', 320), 'size', jsonb_build_object('width', 260, 'height', 20), 'style', jsonb_build_object('fontSize', 12, 'fontWeight', 'normal', 'color', '#6b7280', 'align', 'center')),
            jsonb_build_object('id', 'contact', 'label', 'Contact', 'token', '{{phone}}', 'type', 'text', 'position', jsonb_build_object('x', 20, 'y', 350), 'size', jsonb_build_object('width', 260, 'height', 20), 'style', jsonb_build_object('fontSize', 12, 'fontWeight', 'normal', 'color', '#6b7280', 'align', 'center'))
        ),
        'layout', jsonb_build_object('width', 300, 'height', 480, 'orientation', 'portrait'),
        'design', jsonb_build_object('backgroundColor', '#ffffff', 'borderColor', '#f59e0b', 'borderWidth', 3, 'borderRadius', 12),
        'qrCode', jsonb_build_object('enabled', true, 'position', jsonb_build_object('x', 100, 'y', 420), 'size', 100, 'data', '{{employee_id}}')
    ),
    true
FROM campuses
WHERE NOT EXISTS (
    SELECT 1 FROM id_card_templates 
    WHERE campus_id = campuses.id AND user_type = 'staff'
);

-- Add RLS policies
ALTER TABLE id_card_templates ENABLE ROW LEVEL SECURITY;

-- Admins can manage templates for their campus
CREATE POLICY "Admins can manage templates for their campus" ON id_card_templates
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.campus_id = id_card_templates.campus_id
            AND p.role IN ('super_admin', 'admin')
        )
    );

-- Users can view templates for their campus
CREATE POLICY "Users can view templates for their campus" ON id_card_templates
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.campus_id = id_card_templates.campus_id
        )
    );

-- Comments
COMMENT ON TABLE id_card_templates IS 'Stores customizable ID card templates that schools can design with substitution fields';
COMMENT ON COLUMN id_card_templates.template_config IS 'JSON configuration containing fields, layout, design, and QR code settings';
COMMENT ON COLUMN id_card_templates.user_type IS 'Type of user this template is for: student, teacher, or staff';
COMMENT ON COLUMN id_card_templates.is_active IS 'Only one template per user type per school can be active at a time';
