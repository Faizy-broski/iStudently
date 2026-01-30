-- Custom Field Definitions Table
-- Stores custom field templates for Students and Teachers with sort order and campus scope

-- Create the table
CREATE TABLE IF NOT EXISTS public.custom_field_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('student', 'teacher')),
    category_id TEXT NOT NULL,
    category_name TEXT NOT NULL,
    field_key TEXT NOT NULL,
    label TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text', 'long-text', 'number', 'date', 'checkbox', 'select', 'multi-select', 'file')),
    options JSONB DEFAULT '[]'::jsonb,
    required BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    campus_scope TEXT NOT NULL DEFAULT 'this_campus' CHECK (campus_scope IN ('this_campus', 'selected_campuses', 'all_campuses')),
    applicable_school_ids UUID[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Unique constraint: one field_key per entity_type per school
    UNIQUE(school_id, entity_type, field_key)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_custom_fields_school_id ON public.custom_field_definitions(school_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_entity_type ON public.custom_field_definitions(entity_type);
CREATE INDEX IF NOT EXISTS idx_custom_fields_category_id ON public.custom_field_definitions(category_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_sort_order ON public.custom_field_definitions(sort_order);
CREATE INDEX IF NOT EXISTS idx_custom_fields_is_active ON public.custom_field_definitions(is_active);

-- Enable RLS
ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admin can manage their own school's field definitions
CREATE POLICY "admin_manage_custom_fields" ON public.custom_field_definitions
    FOR ALL
    USING (
        school_id IN (
            SELECT school_id FROM public.admin_schools WHERE profile_id = auth.uid()
        )
        OR
        -- Also allow if this field applies to user's school via applicable_school_ids
        (
            campus_scope = 'selected_campuses' 
            AND EXISTS (
                SELECT 1 FROM public.admin_schools 
                WHERE profile_id = auth.uid() 
                AND school_id = ANY(applicable_school_ids)
            )
        )
        OR
        -- Allow if scope is all_campuses and user's school is a branch of the defining school
        (
            campus_scope = 'all_campuses'
            AND EXISTS (
                SELECT 1 FROM public.schools s
                JOIN public.admin_schools a ON a.school_id = s.id
                WHERE a.profile_id = auth.uid()
                AND s.parent_school_id = custom_field_definitions.school_id
            )
        )
    )
    WITH CHECK (
        school_id IN (
            SELECT school_id FROM public.admin_schools WHERE profile_id = auth.uid()
        )
    );

-- Super admin can manage all
CREATE POLICY "superadmin_manage_custom_fields" ON public.custom_field_definitions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
        )
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_custom_field_definitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_custom_field_definitions_updated_at
    BEFORE UPDATE ON public.custom_field_definitions
    FOR EACH ROW
    EXECUTE FUNCTION update_custom_field_definitions_updated_at();

-- Grant permissions
GRANT ALL ON public.custom_field_definitions TO authenticated;
GRANT SELECT ON public.custom_field_definitions TO anon;
