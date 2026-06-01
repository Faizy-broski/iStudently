-- ========================
-- CLEANUP ORPHANED AUTH USERS
-- ========================
-- Run this in Supabase SQL Editor

-- Step 1: First, let's see which auth users have no profiles
-- (These are the orphaned users that cause "profile not found" errors)
SELECT 
  au.id,
  au.email,
  au.created_at,
  au.raw_user_meta_data->>'first_name' as first_name,
  au.raw_user_meta_data->>'last_name' as last_name
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- Step 2: Delete orphaned auth users (CAUTION: This permanently deletes users!)
-- Uncomment the DELETE statement below ONLY after reviewing Step 1 results
-- Make sure your super_admin email is NOT in the list!

-- IMPORTANT: Replace 'your_superadmin@email.com' with your actual super admin email
-- DELETE FROM auth.users 
-- WHERE id IN (
--   SELECT au.id
--   FROM auth.users au
--   LEFT JOIN profiles p ON au.id = p.id
--   WHERE p.id IS NULL
--   AND au.email != 'your_superadmin@email.com'
-- );

-- ========================
-- ALTERNATIVE: Create profiles for orphaned users
-- ========================
-- If you prefer to keep the auth users and just create profiles for them:

-- INSERT INTO profiles (id, email, role, is_active, created_at, updated_at)
-- SELECT 
--   au.id,
--   au.email,
--   'admin', -- or whatever role is appropriate
--   true,
--   NOW(),
--   NOW()
-- FROM auth.users au
-- LEFT JOIN profiles p ON au.id = p.id
-- WHERE p.id IS NULL
-- AND au.email != 'your_superadmin@email.com';

-- ========================
-- VERIFY CLEANUP
-- ========================
-- Run this after cleanup to confirm no orphaned users remain
SELECT 
  (SELECT COUNT(*) FROM auth.users) as total_auth_users,
  (SELECT COUNT(*) FROM profiles) as total_profiles,
  (SELECT COUNT(*) FROM auth.users au LEFT JOIN profiles p ON au.id = p.id WHERE p.id IS NULL) as orphaned_users;
