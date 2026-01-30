-- Migration: Add default_field_orders table
-- This table stores custom ordering preferences for default (built-in) fields
-- Users can reorder fields like "First Name", "Father's Name", etc.

-- Create the table
CREATE TABLE IF NOT EXISTS public.default_field_orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('student', 'parent', 'teacher')),
  category_id VARCHAR(100) NOT NULL,
  field_label VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure each field is only defined once per school/entity/category
  UNIQUE(school_id, entity_type, category_id, field_label)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_default_field_orders_school 
  ON public.default_field_orders(school_id);

CREATE INDEX IF NOT EXISTS idx_default_field_orders_entity_type 
  ON public.default_field_orders(entity_type);

CREATE INDEX IF NOT EXISTS idx_default_field_orders_lookup 
  ON public.default_field_orders(school_id, entity_type, category_id);

-- Enable RLS
ALTER TABLE public.default_field_orders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only manage their own school's field orders
CREATE POLICY default_field_orders_policy ON public.default_field_orders
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.schools s
      WHERE s.id = default_field_orders.school_id
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_default_field_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_default_field_orders_updated_at
  BEFORE UPDATE ON public.default_field_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_default_field_orders_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.default_field_orders TO authenticated;
