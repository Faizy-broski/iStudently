-- ============================================================
-- Library categories: subcategories + global (all-schools) categories
--   + "featured on e-library homepage" curation (super admin only)
-- ============================================================
-- library_categories/library_document_fields predate this repo's tracked
-- migrations (no CREATE TABLE for them exists elsewhere), so we recreate the
-- base table with IF NOT EXISTS here to keep this migration self-contained
-- and safe to run against a fresh DB, then layer the new columns on top of
-- whatever's already live via ADD COLUMN IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS library_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  color_code VARCHAR(20) DEFAULT '#000000',
  sort_order INTEGER DEFAULT 0,
  visible_to_roles TEXT[] DEFAULT '{}',
  visible_to_grade_levels TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subcategories — RESTRICT (not CASCADE) so a category with children can't be
-- silently deleted; deleteCategory() blocks it explicitly with a clear error
-- instead of surfacing a raw FK violation.
ALTER TABLE library_categories
  ADD COLUMN IF NOT EXISTS parent_category_id UUID REFERENCES library_categories(id) ON DELETE RESTRICT;

-- Global categories: super-admin-curated, shown to every school. school_id
-- still points at the creating school (same shape as
-- custom_field_definitions.campus_scope = 'all_schools') — a global row is
-- just included for every school by an application-level filter rather than
-- a school_id match.
ALTER TABLE library_categories
  ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT FALSE;

-- Featured-on-homepage curation — only meaningful on is_global rows, capped
-- at 10 by the service layer (not DB-enforced; see library.service.ts).
ALTER TABLE library_categories
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE library_categories
  ADD COLUMN IF NOT EXISTS featured_order INTEGER;

CREATE INDEX IF NOT EXISTS idx_library_categories_school ON library_categories(school_id);
CREATE INDEX IF NOT EXISTS idx_library_categories_parent ON library_categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_library_categories_global_featured ON library_categories(is_global, is_featured) WHERE is_global = TRUE;
