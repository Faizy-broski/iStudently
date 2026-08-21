-- Where is Layla? Check her auth user, profile, and student row directly.
SELECT 'auth.users' AS src, id::text, email, NULL AS school_id
FROM auth.users WHERE email = 'faizanhashmi603+student2@gmail.com'
UNION ALL
SELECT 'profiles' AS src, id::text, email, school_id::text
FROM public.profiles WHERE email = 'faizanhashmi603+student2@gmail.com'
UNION ALL
SELECT 'students' AS src, s.id::text, p.email, s.school_id::text
FROM public.students s JOIN public.profiles p ON p.id = s.profile_id
WHERE p.email = 'faizanhashmi603+student2@gmail.com';
