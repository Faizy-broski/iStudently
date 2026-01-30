-- Create admin_schools table to handle Many-to-Many relationship
CREATE TABLE IF NOT EXISTS "public"."admin_schools" (
    "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    "profile_id" UUID NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "school_id" UUID NOT NULL REFERENCES "public"."schools"("id") ON DELETE CASCADE,
    "role" VARCHAR, -- Optional: Can override global role for this specific school
    "is_primary" BOOLEAN DEFAULT false, -- The default school for this user
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE("profile_id", "school_id") -- Prevent duplicate links
);

-- Enable RLS
ALTER TABLE "public"."admin_schools" ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Users can view their own school links
CREATE POLICY "Users can view their own school links" ON "public"."admin_schools"
    FOR SELECT USING (auth.uid() = profile_id);

-- 2. Super Admins can manage all links
CREATE POLICY "Super Admins can manage all school links" ON "public"."admin_schools"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'super_admin'
        )
    );

-- 3. Admins can view/manage links for their schools (simplified for now to own links)
-- (Ideally admins can manage staff links for their schools, but we start simple)

-- Trigger for Updated At
CREATE TRIGGER update_admin_schools_updated_at
    BEFORE UPDATE ON admin_schools
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Data Migration: Populate admin_schools from existing profiles
-- FILTER: Only migrate Admins, Super Admins, Librarians, Teachers, Staff.
-- EXCLUDE: Students and Parents.
INSERT INTO "public"."admin_schools" ("profile_id", "school_id", "role", "is_primary")
SELECT "id", "school_id", "role", true
FROM "public"."profiles"
WHERE "school_id" IS NOT NULL
AND "role" IN ('super_admin', 'admin', 'librarian', 'teacher', 'staff')
ON CONFLICT ("profile_id", "school_id") DO NOTHING;
