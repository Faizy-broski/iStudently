-- Super-admin-controlled allow-list of modules (sidebar module_keys / hrefs)
-- a school is permitted to use. NULL = unrestricted (all modules available,
-- matches pre-existing behavior for every school created before this migration).
-- When set, it's a JSON array of strings, e.g. ["/admin/resources/virtual-labs", "/admin/schedule"].
--
-- This restricts:
--   1. What appears in the sidebar for any user in the school (regardless of profile permissions).
--   2. Which leaf items a school admin can select from when building a User Profile
--      at /admin/settings/user-profiles.
--
-- Only super admins can read/write this column (see /api/school-settings/allowed-modules).
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS allowed_modules jsonb DEFAULT NULL;

COMMENT ON COLUMN school_settings.allowed_modules IS
  'Super-admin allow-list of sidebar module_keys (hrefs) this school may use. NULL = unrestricted.';
