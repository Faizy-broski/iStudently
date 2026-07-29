-- Migration: Allow a Super Admin to scope a custom field to every school in the
-- system (not just the branches of one school family), via a new
-- campus_scope value: 'all_schools'.

-- Drop the existing constraint
ALTER TABLE public.custom_field_definitions DROP CONSTRAINT IF EXISTS custom_field_definitions_campus_scope_check;

-- Add the new constraint including 'all_schools'
ALTER TABLE public.custom_field_definitions ADD CONSTRAINT custom_field_definitions_campus_scope_check
    CHECK (campus_scope IN ('this_campus', 'selected_campuses', 'all_campuses', 'all_schools'));

-- Let the existing "admin_manage_custom_fields" RLS policy also surface
-- all_schools-scoped fields to every school's admins (super admins already
-- bypass RLS via the "superadmin_manage_custom_fields" policy, but regular
-- admins reading through RLS need this branch too).
DROP POLICY IF EXISTS "admin_manage_custom_fields" ON public.custom_field_definitions;
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
        OR
        -- Allow if scope is all_schools — applies system-wide regardless of family
        campus_scope = 'all_schools'
    )
    WITH CHECK (
        school_id IN (
            SELECT school_id FROM public.admin_schools WHERE profile_id = auth.uid()
        )
    );
