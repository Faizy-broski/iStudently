-- =========================================
-- FIX STAFF TABLE - ADD MISSING COLUMNS
-- Run this in Supabase SQL Editor
-- =========================================

-- Add missing columns to staff table if they don't exist
DO $$ 
BEGIN
    -- Add title column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='staff' AND column_name='title') THEN
        ALTER TABLE staff ADD COLUMN title VARCHAR(100);
    END IF;

    -- Add department column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='staff' AND column_name='department') THEN
        ALTER TABLE staff ADD COLUMN department VARCHAR(100);
    END IF;

    -- Add qualifications column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='staff' AND column_name='qualifications') THEN
        ALTER TABLE staff ADD COLUMN qualifications TEXT;
    END IF;

    -- Add specialization column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='staff' AND column_name='specialization') THEN
        ALTER TABLE staff ADD COLUMN specialization VARCHAR(200);
    END IF;

    -- Add date_of_joining column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='staff' AND column_name='date_of_joining') THEN
        ALTER TABLE staff ADD COLUMN date_of_joining DATE;
    END IF;

    -- Add employment_type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='staff' AND column_name='employment_type') THEN
        ALTER TABLE staff ADD COLUMN employment_type VARCHAR(20) DEFAULT 'full_time' 
            CHECK (employment_type IN ('full_time', 'part_time', 'contract'));
    END IF;

    -- Add permissions column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='staff' AND column_name='permissions') THEN
        ALTER TABLE staff ADD COLUMN permissions JSONB DEFAULT '{}';
    END IF;

    -- Add created_by column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='staff' AND column_name='created_by') THEN
        ALTER TABLE staff ADD COLUMN created_by UUID REFERENCES profiles(id);
    END IF;

    -- Add is_active column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='staff' AND column_name='is_active') THEN
        ALTER TABLE staff ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
