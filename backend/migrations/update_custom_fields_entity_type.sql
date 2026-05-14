-- Migration: Update custom_field_definitions entity_type constraint to include 'parent'

-- Drop the existing constraint
ALTER TABLE public.custom_field_definitions DROP CONSTRAINT custom_field_definitions_entity_type_check;

-- Add the new constraint including 'parent'
ALTER TABLE public.custom_field_definitions ADD CONSTRAINT custom_field_definitions_entity_type_check CHECK (entity_type IN ('student', 'teacher', 'parent'));
