-- Learning Resources System
-- Allows teachers to share resources (links, books, posts, files) with section students

-- Create resource types enum
DO $$ BEGIN
    CREATE TYPE resource_type AS ENUM ('link', 'book', 'post', 'file', 'video');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Main learning_resources table
CREATE TABLE IF NOT EXISTS learning_resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    campus_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    
    -- Teacher who created the resource
    teacher_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    
    -- Target audience (section-specific or subject-specific)
    section_id UUID REFERENCES sections(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    grade_level_id UUID REFERENCES grade_levels(id) ON DELETE CASCADE,
    
    -- Resource details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    resource_type VARCHAR(20) NOT NULL DEFAULT 'link', -- link, book, post, file, video
    
    -- For links/videos
    url TEXT,
    
    -- For posts (rich text content)
    content TEXT,
    
    -- For files (stored in learning-resources bucket)
    file_urls TEXT[], -- Array of file URLs
    
    -- For books
    book_title VARCHAR(255),
    book_author VARCHAR(255),
    book_isbn VARCHAR(50),
    book_cover_url TEXT,
    
    -- Metadata
    tags TEXT[],
    is_pinned BOOLEAN DEFAULT false,
    is_published BOOLEAN DEFAULT true,
    view_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_learning_resources_school ON learning_resources(school_id);
CREATE INDEX IF NOT EXISTS idx_learning_resources_campus ON learning_resources(campus_id);
CREATE INDEX IF NOT EXISTS idx_learning_resources_teacher ON learning_resources(teacher_id);
CREATE INDEX IF NOT EXISTS idx_learning_resources_section ON learning_resources(section_id);
CREATE INDEX IF NOT EXISTS idx_learning_resources_subject ON learning_resources(subject_id);
CREATE INDEX IF NOT EXISTS idx_learning_resources_type ON learning_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_learning_resources_published ON learning_resources(is_published);
CREATE INDEX IF NOT EXISTS idx_learning_resources_created ON learning_resources(created_at DESC);

-- Track which students have viewed resources
CREATE TABLE IF NOT EXISTS learning_resource_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_id UUID NOT NULL REFERENCES learning_resources(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(resource_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_resource_views_resource ON learning_resource_views(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_views_student ON learning_resource_views(student_id);

-- Enable RLS
ALTER TABLE learning_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_resource_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies for learning_resources

-- Teachers can view resources they created or resources in their school
CREATE POLICY "learning_resources_select_policy" ON learning_resources
FOR SELECT USING (
    -- Admin can see all in their school
    (EXISTS (
        SELECT 1 FROM staff s 
        WHERE s.profile_id = auth.uid() 
        AND s.school_id = learning_resources.school_id
        AND s.role IN ('admin', 'school_admin', 'super_admin')
    ))
    OR
    -- Teachers can see resources in their school
    (EXISTS (
        SELECT 1 FROM staff s 
        WHERE s.profile_id = auth.uid() 
        AND s.school_id = learning_resources.school_id
    ))
    OR
    -- Students can see published resources for their section
    (is_published = true AND EXISTS (
        SELECT 1 FROM students st 
        WHERE st.profile_id = auth.uid() 
        AND st.school_id = learning_resources.school_id
        AND st.section_id = learning_resources.section_id
    ))
);

-- Teachers can insert resources
CREATE POLICY "learning_resources_insert_policy" ON learning_resources
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM staff s 
        WHERE s.profile_id = auth.uid() 
        AND s.school_id = learning_resources.school_id
        AND s.id = learning_resources.teacher_id
    )
);

-- Teachers can update their own resources
CREATE POLICY "learning_resources_update_policy" ON learning_resources
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM staff s 
        WHERE s.profile_id = auth.uid() 
        AND s.id = learning_resources.teacher_id
    )
) WITH CHECK (
    EXISTS (
        SELECT 1 FROM staff s 
        WHERE s.profile_id = auth.uid() 
        AND s.id = learning_resources.teacher_id
    )
);

-- Teachers can delete their own resources
CREATE POLICY "learning_resources_delete_policy" ON learning_resources
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM staff s 
        WHERE s.profile_id = auth.uid() 
        AND s.id = learning_resources.teacher_id
    )
);

-- RLS Policies for learning_resource_views
CREATE POLICY "resource_views_select_policy" ON learning_resource_views
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM learning_resources lr
        JOIN staff s ON s.id = lr.teacher_id
        WHERE lr.id = learning_resource_views.resource_id
        AND s.profile_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM students st
        WHERE st.profile_id = auth.uid()
        AND st.id = learning_resource_views.student_id
    )
);

CREATE POLICY "resource_views_insert_policy" ON learning_resource_views
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM students st
        WHERE st.profile_id = auth.uid()
        AND st.id = learning_resource_views.student_id
    )
);

-- Storage policies for learning-resources bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('learning-resources', 'learning-resources', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if any
DROP POLICY IF EXISTS "learning_resources_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "learning_resources_read_policy" ON storage.objects;
DROP POLICY IF EXISTS "learning_resources_delete_policy" ON storage.objects;
DROP POLICY IF EXISTS "learning_resources_update_policy" ON storage.objects;

-- Storage Upload Policy
CREATE POLICY "learning_resources_upload_policy"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'learning-resources');

-- Storage Read Policy (public access)
CREATE POLICY "learning_resources_read_policy"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'learning-resources');

-- Storage Update Policy
CREATE POLICY "learning_resources_update_policy"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'learning-resources')
WITH CHECK (bucket_id = 'learning-resources');

-- Storage Delete Policy
CREATE POLICY "learning_resources_delete_policy"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'learning-resources');

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_learning_resources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS learning_resources_updated_at ON learning_resources;
CREATE TRIGGER learning_resources_updated_at
    BEFORE UPDATE ON learning_resources
    FOR EACH ROW
    EXECUTE FUNCTION update_learning_resources_updated_at();

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_resource_view_count(resource_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE learning_resources 
    SET view_count = view_count + 1
    WHERE id = resource_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify tables created
SELECT 'learning_resources table created' as status, count(*) as columns 
FROM information_schema.columns 
WHERE table_name = 'learning_resources';
