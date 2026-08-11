-- Migration: Create Certificate Templates System
-- Description: Allows schools to design reusable, drag-and-drop certificate templates
-- (A4 portrait/landscape) for students, teachers, and staff, tagged by occasion.

-- Create certificate_templates table
CREATE TABLE IF NOT EXISTS certificate_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campus_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('student', 'teacher', 'staff')),
    occasion VARCHAR(50) DEFAULT 'general',

    -- Template configuration stored as JSON
    -- Structure: {
    --   fields: [{id, label, token, type: 'text'|'image', position: {x, y}, size: {width, height}, style?: {fontSize, fontWeight, color, align}}],
    --   layout: {width, height, orientation: 'portrait'|'landscape'},   -- A4 @96dpi: 794x1123 portrait / 1123x794 landscape
    --   design: {backgroundColor, borderColor, borderWidth, borderRadius, backgroundImage}
    -- }
    template_config JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Convenience "starred" flag only — unlike ID cards, certificates are picked
    -- ad hoc per batch, so there is no single "active" template per recipient type.
    is_default BOOLEAN DEFAULT false,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_certificate_templates_campus_id ON certificate_templates(campus_id);
CREATE INDEX IF NOT EXISTS idx_certificate_templates_recipient_type ON certificate_templates(campus_id, recipient_type);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_certificate_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_certificate_templates_updated_at ON certificate_templates;
CREATE TRIGGER trigger_update_certificate_templates_updated_at
    BEFORE UPDATE ON certificate_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_certificate_templates_updated_at();

-- Seed ready-to-use starter templates for each campus
-- (landscape A4 = 1123x794 px @96dpi)

-- Certificate of Achievement (student)
INSERT INTO certificate_templates (campus_id, name, description, recipient_type, occasion, template_config)
SELECT
    id as campus_id,
    'Certificate of Achievement',
    'Classic gold-bordered certificate for student achievements and awards',
    'student',
    'achievement',
    jsonb_build_object(
        'fields', jsonb_build_array(
            jsonb_build_object('id', 'logo', 'label', 'School Logo', 'token', '{{school_logo}}', 'type', 'image', 'position', jsonb_build_object('x', 481, 'y', 50), 'size', jsonb_build_object('width', 80, 'height', 80)),
            jsonb_build_object('id', 'title', 'label', 'Title', 'token', 'Certificate of Achievement', 'type', 'text', 'position', jsonb_build_object('x', 161, 'y', 150), 'size', jsonb_build_object('width', 800, 'height', 50), 'style', jsonb_build_object('fontSize', 36, 'fontWeight', 'bold', 'color', '#92400e', 'align', 'center')),
            jsonb_build_object('id', 'subtitle', 'label', 'Subtitle', 'token', 'This certificate is proudly presented to', 'type', 'text', 'position', jsonb_build_object('x', 161, 'y', 215), 'size', jsonb_build_object('width', 800, 'height', 25), 'style', jsonb_build_object('fontSize', 15, 'fontWeight', 'normal', 'color', '#6b7280', 'align', 'center')),
            jsonb_build_object('id', 'name', 'label', 'Recipient Name', 'token', '{{first_name}} {{last_name}}', 'type', 'text', 'position', jsonb_build_object('x', 161, 'y', 260), 'size', jsonb_build_object('width', 800, 'height', 55), 'style', jsonb_build_object('fontSize', 40, 'fontWeight', 'bold', 'color', '#1f2937', 'align', 'center')),
            jsonb_build_object('id', 'body', 'label', 'Body', 'token', 'for outstanding achievement in {{grade_level}} during the {{academic_year}} academic year', 'type', 'text', 'position', jsonb_build_object('x', 261, 'y', 335), 'size', jsonb_build_object('width', 600, 'height', 40), 'style', jsonb_build_object('fontSize', 15, 'fontWeight', 'normal', 'color', '#4b5563', 'align', 'center')),
            jsonb_build_object('id', 'date', 'label', 'Date', 'token', 'Issued on {{current_date}}', 'type', 'text', 'position', jsonb_build_object('x', 141, 'y', 680), 'size', jsonb_build_object('width', 260, 'height', 24), 'style', jsonb_build_object('fontSize', 13, 'fontWeight', 'normal', 'color', '#6b7280', 'align', 'center')),
            jsonb_build_object('id', 'signature', 'label', 'Signature', 'token', '{{school_principal}}', 'type', 'text', 'position', jsonb_build_object('x', 722, 'y', 680), 'size', jsonb_build_object('width', 260, 'height', 24), 'style', jsonb_build_object('fontSize', 13, 'fontWeight', 'bold', 'color', '#1f2937', 'align', 'center')),
            jsonb_build_object('id', 'signature_label', 'label', 'Signature Label', 'token', 'Principal', 'type', 'text', 'position', jsonb_build_object('x', 722, 'y', 704), 'size', jsonb_build_object('width', 260, 'height', 20), 'style', jsonb_build_object('fontSize', 11, 'fontWeight', 'normal', 'color', '#6b7280', 'align', 'center'))
        ),
        'layout', jsonb_build_object('width', 1123, 'height', 794, 'orientation', 'landscape'),
        'design', jsonb_build_object('backgroundColor', '#fffbeb', 'borderColor', '#d97706', 'borderWidth', 6, 'borderRadius', 4)
    )
FROM schools
WHERE NOT EXISTS (
    SELECT 1 FROM certificate_templates
    WHERE campus_id = schools.id AND recipient_type = 'student' AND occasion = 'achievement'
);

-- Certificate of Appreciation (student)
INSERT INTO certificate_templates (campus_id, name, description, recipient_type, occasion, template_config)
SELECT
    id as campus_id,
    'Certificate of Appreciation',
    'Warm blue-toned certificate to recognize student participation and effort',
    'student',
    'appreciation',
    jsonb_build_object(
        'fields', jsonb_build_array(
            jsonb_build_object('id', 'logo', 'label', 'School Logo', 'token', '{{school_logo}}', 'type', 'image', 'position', jsonb_build_object('x', 481, 'y', 50), 'size', jsonb_build_object('width', 80, 'height', 80)),
            jsonb_build_object('id', 'title', 'label', 'Title', 'token', 'Certificate of Appreciation', 'type', 'text', 'position', jsonb_build_object('x', 161, 'y', 150), 'size', jsonb_build_object('width', 800, 'height', 50), 'style', jsonb_build_object('fontSize', 36, 'fontWeight', 'bold', 'color', '#1e40af', 'align', 'center')),
            jsonb_build_object('id', 'subtitle', 'label', 'Subtitle', 'token', 'In recognition of the dedication and effort of', 'type', 'text', 'position', jsonb_build_object('x', 161, 'y', 215), 'size', jsonb_build_object('width', 800, 'height', 25), 'style', jsonb_build_object('fontSize', 15, 'fontWeight', 'normal', 'color', '#6b7280', 'align', 'center')),
            jsonb_build_object('id', 'name', 'label', 'Recipient Name', 'token', '{{first_name}} {{last_name}}', 'type', 'text', 'position', jsonb_build_object('x', 161, 'y', 260), 'size', jsonb_build_object('width', 800, 'height', 55), 'style', jsonb_build_object('fontSize', 40, 'fontWeight', 'bold', 'color', '#1f2937', 'align', 'center')),
            jsonb_build_object('id', 'body', 'label', 'Body', 'token', 'for {{section}} - {{grade_level}}, {{academic_year}}', 'type', 'text', 'position', jsonb_build_object('x', 261, 'y', 335), 'size', jsonb_build_object('width', 600, 'height', 40), 'style', jsonb_build_object('fontSize', 15, 'fontWeight', 'normal', 'color', '#4b5563', 'align', 'center')),
            jsonb_build_object('id', 'date', 'label', 'Date', 'token', 'Issued on {{current_date}}', 'type', 'text', 'position', jsonb_build_object('x', 141, 'y', 680), 'size', jsonb_build_object('width', 260, 'height', 24), 'style', jsonb_build_object('fontSize', 13, 'fontWeight', 'normal', 'color', '#6b7280', 'align', 'center')),
            jsonb_build_object('id', 'signature', 'label', 'Signature', 'token', '{{school_principal}}', 'type', 'text', 'position', jsonb_build_object('x', 722, 'y', 680), 'size', jsonb_build_object('width', 260, 'height', 24), 'style', jsonb_build_object('fontSize', 13, 'fontWeight', 'bold', 'color', '#1f2937', 'align', 'center')),
            jsonb_build_object('id', 'signature_label', 'label', 'Signature Label', 'token', 'Principal', 'type', 'text', 'position', jsonb_build_object('x', 722, 'y', 704), 'size', jsonb_build_object('width', 260, 'height', 20), 'style', jsonb_build_object('fontSize', 11, 'fontWeight', 'normal', 'color', '#6b7280', 'align', 'center'))
        ),
        'layout', jsonb_build_object('width', 1123, 'height', 794, 'orientation', 'landscape'),
        'design', jsonb_build_object('backgroundColor', '#eff6ff', 'borderColor', '#2563eb', 'borderWidth', 6, 'borderRadius', 4)
    )
FROM schools
WHERE NOT EXISTS (
    SELECT 1 FROM certificate_templates
    WHERE campus_id = schools.id AND recipient_type = 'student' AND occasion = 'appreciation'
);

-- Certificate of Completion (student)
INSERT INTO certificate_templates (campus_id, name, description, recipient_type, occasion, template_config)
SELECT
    id as campus_id,
    'Certificate of Completion',
    'Clean green certificate for course, program, or enrollment completion',
    'student',
    'completion',
    jsonb_build_object(
        'fields', jsonb_build_array(
            jsonb_build_object('id', 'logo', 'label', 'School Logo', 'token', '{{school_logo}}', 'type', 'image', 'position', jsonb_build_object('x', 481, 'y', 50), 'size', jsonb_build_object('width', 80, 'height', 80)),
            jsonb_build_object('id', 'title', 'label', 'Title', 'token', 'Certificate of Completion', 'type', 'text', 'position', jsonb_build_object('x', 161, 'y', 150), 'size', jsonb_build_object('width', 800, 'height', 50), 'style', jsonb_build_object('fontSize', 36, 'fontWeight', 'bold', 'color', '#065f46', 'align', 'center')),
            jsonb_build_object('id', 'subtitle', 'label', 'Subtitle', 'token', 'This is to certify that', 'type', 'text', 'position', jsonb_build_object('x', 161, 'y', 215), 'size', jsonb_build_object('width', 800, 'height', 25), 'style', jsonb_build_object('fontSize', 15, 'fontWeight', 'normal', 'color', '#6b7280', 'align', 'center')),
            jsonb_build_object('id', 'name', 'label', 'Recipient Name', 'token', '{{first_name}} {{last_name}}', 'type', 'text', 'position', jsonb_build_object('x', 161, 'y', 260), 'size', jsonb_build_object('width', 800, 'height', 55), 'style', jsonb_build_object('fontSize', 40, 'fontWeight', 'bold', 'color', '#1f2937', 'align', 'center')),
            jsonb_build_object('id', 'body', 'label', 'Body', 'token', 'has successfully completed {{grade_level}} at {{school_name}} for the {{academic_year}} academic year', 'type', 'text', 'position', jsonb_build_object('x', 231, 'y', 335), 'size', jsonb_build_object('width', 660, 'height', 40), 'style', jsonb_build_object('fontSize', 15, 'fontWeight', 'normal', 'color', '#4b5563', 'align', 'center')),
            jsonb_build_object('id', 'date', 'label', 'Date', 'token', 'Issued on {{current_date}}', 'type', 'text', 'position', jsonb_build_object('x', 141, 'y', 680), 'size', jsonb_build_object('width', 260, 'height', 24), 'style', jsonb_build_object('fontSize', 13, 'fontWeight', 'normal', 'color', '#6b7280', 'align', 'center')),
            jsonb_build_object('id', 'signature', 'label', 'Signature', 'token', '{{school_principal}}', 'type', 'text', 'position', jsonb_build_object('x', 722, 'y', 680), 'size', jsonb_build_object('width', 260, 'height', 24), 'style', jsonb_build_object('fontSize', 13, 'fontWeight', 'bold', 'color', '#1f2937', 'align', 'center')),
            jsonb_build_object('id', 'signature_label', 'label', 'Signature Label', 'token', 'Principal', 'type', 'text', 'position', jsonb_build_object('x', 722, 'y', 704), 'size', jsonb_build_object('width', 260, 'height', 20), 'style', jsonb_build_object('fontSize', 11, 'fontWeight', 'normal', 'color', '#6b7280', 'align', 'center'))
        ),
        'layout', jsonb_build_object('width', 1123, 'height', 794, 'orientation', 'landscape'),
        'design', jsonb_build_object('backgroundColor', '#ecfdf5', 'borderColor', '#059669', 'borderWidth', 6, 'borderRadius', 4)
    )
FROM schools
WHERE NOT EXISTS (
    SELECT 1 FROM certificate_templates
    WHERE campus_id = schools.id AND recipient_type = 'student' AND occasion = 'completion'
);

-- Employee of the Month (staff)
INSERT INTO certificate_templates (campus_id, name, description, recipient_type, occasion, template_config)
SELECT
    id as campus_id,
    'Employee of the Month',
    'Recognition certificate for outstanding staff performance',
    'staff',
    'employee_of_month',
    jsonb_build_object(
        'fields', jsonb_build_array(
            jsonb_build_object('id', 'logo', 'label', 'School Logo', 'token', '{{school_logo}}', 'type', 'image', 'position', jsonb_build_object('x', 481, 'y', 50), 'size', jsonb_build_object('width', 80, 'height', 80)),
            jsonb_build_object('id', 'title', 'label', 'Title', 'token', 'Employee of the Month', 'type', 'text', 'position', jsonb_build_object('x', 161, 'y', 150), 'size', jsonb_build_object('width', 800, 'height', 50), 'style', jsonb_build_object('fontSize', 36, 'fontWeight', 'bold', 'color', '#78350f', 'align', 'center')),
            jsonb_build_object('id', 'subtitle', 'label', 'Subtitle', 'token', 'This award is proudly presented to', 'type', 'text', 'position', jsonb_build_object('x', 161, 'y', 215), 'size', jsonb_build_object('width', 800, 'height', 25), 'style', jsonb_build_object('fontSize', 15, 'fontWeight', 'normal', 'color', '#6b7280', 'align', 'center')),
            jsonb_build_object('id', 'name', 'label', 'Recipient Name', 'token', '{{first_name}} {{last_name}}', 'type', 'text', 'position', jsonb_build_object('x', 161, 'y', 260), 'size', jsonb_build_object('width', 800, 'height', 55), 'style', jsonb_build_object('fontSize', 40, 'fontWeight', 'bold', 'color', '#1f2937', 'align', 'center')),
            jsonb_build_object('id', 'body', 'label', 'Body', 'token', 'for {{role}} in {{department}}, in recognition of exceptional dedication and performance', 'type', 'text', 'position', jsonb_build_object('x', 231, 'y', 335), 'size', jsonb_build_object('width', 660, 'height', 40), 'style', jsonb_build_object('fontSize', 15, 'fontWeight', 'normal', 'color', '#4b5563', 'align', 'center')),
            jsonb_build_object('id', 'date', 'label', 'Date', 'token', 'Issued on {{current_date}}', 'type', 'text', 'position', jsonb_build_object('x', 141, 'y', 680), 'size', jsonb_build_object('width', 260, 'height', 24), 'style', jsonb_build_object('fontSize', 13, 'fontWeight', 'normal', 'color', '#6b7280', 'align', 'center')),
            jsonb_build_object('id', 'signature', 'label', 'Signature', 'token', '{{school_principal}}', 'type', 'text', 'position', jsonb_build_object('x', 722, 'y', 680), 'size', jsonb_build_object('width', 260, 'height', 24), 'style', jsonb_build_object('fontSize', 13, 'fontWeight', 'bold', 'color', '#1f2937', 'align', 'center')),
            jsonb_build_object('id', 'signature_label', 'label', 'Signature Label', 'token', 'Head of School', 'type', 'text', 'position', jsonb_build_object('x', 722, 'y', 704), 'size', jsonb_build_object('width', 260, 'height', 20), 'style', jsonb_build_object('fontSize', 11, 'fontWeight', 'normal', 'color', '#6b7280', 'align', 'center'))
        ),
        'layout', jsonb_build_object('width', 1123, 'height', 794, 'orientation', 'landscape'),
        'design', jsonb_build_object('backgroundColor', '#fffbeb', 'borderColor', '#b45309', 'borderWidth', 6, 'borderRadius', 4)
    )
FROM schools
WHERE NOT EXISTS (
    SELECT 1 FROM certificate_templates
    WHERE campus_id = schools.id AND recipient_type = 'staff' AND occasion = 'employee_of_month'
);

-- RLS policies
ALTER TABLE certificate_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage certificate templates for their campus" ON certificate_templates;
CREATE POLICY "Admins can manage certificate templates for their campus" ON certificate_templates
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.school_id = certificate_templates.campus_id
            AND p.role IN ('super_admin', 'admin')
        )
    );

DROP POLICY IF EXISTS "Users can view certificate templates for their campus" ON certificate_templates;
CREATE POLICY "Users can view certificate templates for their campus" ON certificate_templates
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.school_id = certificate_templates.campus_id
        )
    );

-- Comments
COMMENT ON TABLE certificate_templates IS 'Stores customizable, drag-and-drop A4 certificate templates for students, teachers, and staff';
COMMENT ON COLUMN certificate_templates.template_config IS 'JSON configuration containing fields, layout (A4 portrait/landscape), and design settings';
COMMENT ON COLUMN certificate_templates.recipient_type IS 'Type of recipient this template is for: student, teacher, or staff';
COMMENT ON COLUMN certificate_templates.occasion IS 'Free-form tag used to group/filter ready-to-use designs (achievement, appreciation, completion, employee_of_month, graduation, sports_day, general, custom, ...)';
