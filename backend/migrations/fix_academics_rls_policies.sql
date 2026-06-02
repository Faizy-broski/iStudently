-- =========================================
-- FIX RLS POLICIES FOR ACADEMICS TABLES
-- Run this ONLY to fix the "Forbidden: Insufficient permissions" error
-- This is a standalone fix - DO NOT run the original create_academics_tables.sql again
-- =========================================

-- Drop existing policies
DROP POLICY IF EXISTS grade_levels_admin_all ON grade_levels;
DROP POLICY IF EXISTS sections_admin_all ON sections;
DROP POLICY IF EXISTS subjects_admin_all ON subjects;
DROP POLICY IF EXISTS grade_levels_teacher_read ON grade_levels;
DROP POLICY IF EXISTS sections_teacher_read ON sections;
DROP POLICY IF EXISTS subjects_teacher_read ON subjects;

-- Recreate with proper WITH CHECK clauses for INSERT operations

-- Grade Levels: Admin and Super Admin can do everything
CREATE POLICY grade_levels_admin_all ON grade_levels
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
            AND (role = 'super_admin' OR school_id = grade_levels.school_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
            AND (role = 'super_admin' OR school_id = grade_levels.school_id)
        )
    );

-- Sections: Admin and Super Admin can do everything
CREATE POLICY sections_admin_all ON sections
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
            AND (role = 'super_admin' OR school_id = sections.school_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
            AND (role = 'super_admin' OR school_id = sections.school_id)
        )
    );

-- Subjects: Admin and Super Admin can do everything
CREATE POLICY subjects_admin_all ON subjects
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
            AND (role = 'super_admin' OR school_id = subjects.school_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin')
            AND (role = 'super_admin' OR school_id = subjects.school_id)
        )
    );

-- Teacher policies for SELECT operations
CREATE POLICY grade_levels_teacher_read ON grade_levels
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'teacher'
            AND school_id = grade_levels.school_id
        )
    );

CREATE POLICY sections_teacher_read ON sections
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'teacher'
            AND school_id = sections.school_id
        )
    );

CREATE POLICY subjects_teacher_read ON subjects
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role = 'teacher'
            AND school_id = subjects.school_id
        )
    );

-- Fix RPC functions to work with service role
ALTER FUNCTION get_grade_with_stats(UUID) SECURITY DEFINER;
ALTER FUNCTION get_sections_by_grade(UUID, UUID) SECURITY DEFINER;
ALTER FUNCTION get_subjects_by_grade(UUID, UUID) SECURITY DEFINER;
