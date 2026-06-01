-- Add parent_school_id to schools to support branching
ALTER TABLE "public"."schools" 
ADD COLUMN IF NOT EXISTS "parent_school_id" UUID REFERENCES "public"."schools"("id") ON DELETE SET NULL;

-- Index for performance when fetching branches
CREATE INDEX IF NOT EXISTS "schools_parent_school_id_idx" ON "public"."schools"("parent_school_id");
