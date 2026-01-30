-- Check current staff roles
SELECT 
    s.id,
    s.title,
    s.role as staff_role,
    p.role as profile_role,
    p.first_name,
    p.last_name,
    p.email,
    s.is_active
FROM staff s
LEFT JOIN profiles p ON s.profile_id = p.id
ORDER BY s.created_at DESC;

-- Count by role
SELECT 
    role,
    COUNT(*) as count
FROM staff
WHERE is_active = true
GROUP BY role
ORDER BY count DESC;
