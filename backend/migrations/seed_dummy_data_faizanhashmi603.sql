-- =====================================================================
-- DUMMY / DEMO DATA SEED
-- Run this once in the Supabase SQL Editor (connected as the `postgres`
-- role, which the SQL Editor uses by default — it can write to auth.*).
--
-- Creates one demo school with:
--   - 1 admin      faizanhashmi603+school@gmail.com
--   - 1 teacher    faizanhashmi603+teacher@gmail.com
--   - 2 students    faizanhashmi603+student@gmail.com   (Ahmed Mohamed, Grade 5)
--                    faizanhashmi603+student2@gmail.com  (Layla Mohamed, Grade 3 — sibling)
--   - 1 parent     faizanhashmi603+parent@gmail.com     (linked to both children)
-- Password for all accounts: 123123123
--
-- Also seeds:
--   - Academic year 2026-2027, grade levels (Grade 3 & Grade 5) + sections
--   - Tuition fee categories/structures split into 3 installments per grade,
--     and both students' fee records (1st paid, 2nd due soon, 3rd upcoming)
--     so the Fee Payment Timeline has real data on student/parent dashboards
--   - Subjects, marking periods (2 semesters), courses + course periods for
--     Grade 5 so gradebook/attendance/exam screens have something to show
--   - Two weeks of attendance history for Ahmed
--   - One completed exam + result for Ahmed
--   - A few library books
--   - A few school calendar events
--   - school_settings row enabling a curated set of plugins (Automatic
--     Attendance, Discipline Score, Two-Factor Auth, etc.) and LYD currency
--
-- Safe to re-run: exits early if this school already exists.
--
-- Module sections below "8." are wrapped in their own BEGIN/EXCEPTION
-- blocks — if any single guessed table/column doesn't match your exact
-- schema, that one section is skipped (with a NOTICE) instead of rolling
-- back the whole seed.
-- =====================================================================

-- pgcrypto powers password hashing (extensions.crypt / gen_salt) —
-- Supabase projects ship this pre-installed in the `extensions` schema.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------
-- Helper: create (or reuse) a Supabase Auth user + matching identity row.
-- Dropped again at the end of this script.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.__seed_create_auth_user(
  p_email      text,
  p_password   text,
  p_first_name text,
  p_last_name  text,
  p_role       text
) RETURNS uuid
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM auth.users WHERE email = p_email;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  v_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, recovery_sent_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('first_name', p_first_name, 'last_name', p_last_name, 'role', p_role),
    now(), now(),
    '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  );

  RETURN v_id;
END;
$fn$;

-- ---------------------------------------------------------------------
-- Main seed
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_school_id       uuid;
  v_admin_id        uuid;
  v_teacher_id      uuid;
  v_student_auth_id uuid;
  v_student2_auth_id uuid;
  v_parent_auth_id  uuid;

  v_academic_year_id uuid;
  v_grade_level_id   uuid; -- Grade 5 (Ahmed)
  v_section_id       uuid; -- Grade 5 / Section A
  v_grade3_id        uuid; -- Grade 3 (Layla)
  v_section3_id       uuid; -- Grade 3 / Section A

  v_staff_id   uuid;
  v_student_id uuid;  -- Ahmed
  v_student2_id uuid; -- Layla (sibling, no login)
  v_parent_row_id uuid;

  v_fee_category_id uuid;
  v_fs1 uuid; v_fs2 uuid; v_fs3 uuid;
  v_sf1 uuid; v_sf2 uuid; v_sf3 uuid;
  v_fs1b uuid; v_fs2b uuid; v_fs3b uuid;
  v_sf1b uuid; v_sf2b uuid; v_sf3b uuid;

  -- Module sections 8+ (best-effort — wrapped individually below)
  v_subject_math_id uuid; v_subject_sci_id uuid; v_subject_eng_id uuid;
  v_mp1_id uuid; v_mp2_id uuid;
  v_course_math_id uuid; v_course_sci_id uuid; v_course_eng_id uuid;
  v_exam_type_id uuid; v_exam_id uuid;
  v_day date;
BEGIN
  -- Bail out if this seed already ran
  IF EXISTS (SELECT 1 FROM public.schools WHERE slug = 'al-noor-international') THEN
    RAISE NOTICE 'Seed already applied (school "al-noor-international" exists) — skipping.';
    RETURN;
  END IF;

  ---------------------------------------------------------------------
  -- 1. School
  ---------------------------------------------------------------------
  INSERT INTO public.schools (name, slug, contact_email, status, is_trial)
  VALUES ('Al-Noor International School', 'al-noor-international', 'faizanhashmi603+school@gmail.com', 'active', false)
  RETURNING id INTO v_school_id;

  ---------------------------------------------------------------------
  -- 2. Auth users (admin, teacher, student, parent)
  ---------------------------------------------------------------------
  v_admin_id        := public.__seed_create_auth_user('faizanhashmi603+school@gmail.com',  '123123123', 'School',  'Admin',   'admin');
  v_teacher_id      := public.__seed_create_auth_user('faizanhashmi603+teacher@gmail.com',  '123123123', 'Sara',    'Ali',     'teacher');
  v_student_auth_id  := public.__seed_create_auth_user('faizanhashmi603+student@gmail.com',  '123123123', 'Ahmed',   'Mohamed', 'student');
  v_student2_auth_id := public.__seed_create_auth_user('faizanhashmi603+student2@gmail.com', '123123123', 'Layla',   'Mohamed', 'student');
  v_parent_auth_id   := public.__seed_create_auth_user('faizanhashmi603+parent@gmail.com',   '123123123', 'Faizan',  'Hashmi',  'parent');

  ---------------------------------------------------------------------
  -- 3. Profiles
  -- (a DB trigger on auth.users already inserted a bare profile row for
  -- each user above, so upsert to fill in the rest instead of inserting)
  ---------------------------------------------------------------------
  INSERT INTO public.profiles (id, school_id, role, first_name, last_name, email, username, is_active)
  VALUES (v_admin_id, v_school_id, 'admin', 'School', 'Admin', 'faizanhashmi603+school@gmail.com', 'school.admin', true)
  ON CONFLICT (id) DO UPDATE SET
    school_id = EXCLUDED.school_id, role = EXCLUDED.role, first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name, email = EXCLUDED.email, username = EXCLUDED.username, is_active = EXCLUDED.is_active;

  INSERT INTO public.profiles (id, school_id, role, first_name, last_name, email, username, gender, is_active)
  VALUES (v_teacher_id, v_school_id, 'teacher', 'Sara', 'Ali', 'faizanhashmi603+teacher@gmail.com', 'sara.ali', 'female', true)
  ON CONFLICT (id) DO UPDATE SET
    school_id = EXCLUDED.school_id, role = EXCLUDED.role, first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name, email = EXCLUDED.email, username = EXCLUDED.username,
    gender = EXCLUDED.gender, is_active = EXCLUDED.is_active;

  INSERT INTO public.profiles (id, school_id, role, first_name, last_name, email, username, gender, date_of_birth, is_active)
  VALUES (v_student_auth_id, v_school_id, 'student', 'Ahmed', 'Mohamed', 'faizanhashmi603+student@gmail.com', 'ahmed.mohamed', 'male', '2014-05-10', true)
  ON CONFLICT (id) DO UPDATE SET
    school_id = EXCLUDED.school_id, role = EXCLUDED.role, first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name, email = EXCLUDED.email, username = EXCLUDED.username,
    gender = EXCLUDED.gender, date_of_birth = EXCLUDED.date_of_birth, is_active = EXCLUDED.is_active;

  INSERT INTO public.profiles (id, school_id, role, first_name, last_name, email, username, gender, date_of_birth, is_active)
  VALUES (v_student2_auth_id, v_school_id, 'student', 'Layla', 'Mohamed', 'faizanhashmi603+student2@gmail.com', 'layla.mohamed', 'female', '2016-02-20', true)
  ON CONFLICT (id) DO UPDATE SET
    school_id = EXCLUDED.school_id, role = EXCLUDED.role, first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name, email = EXCLUDED.email, username = EXCLUDED.username,
    gender = EXCLUDED.gender, date_of_birth = EXCLUDED.date_of_birth, is_active = EXCLUDED.is_active;

  INSERT INTO public.profiles (id, school_id, role, first_name, last_name, email, username, is_active)
  VALUES (v_parent_auth_id, v_school_id, 'parent', 'Faizan', 'Hashmi', 'faizanhashmi603+parent@gmail.com', 'faizan.hashmi', true)
  ON CONFLICT (id) DO UPDATE SET
    school_id = EXCLUDED.school_id, role = EXCLUDED.role, first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name, email = EXCLUDED.email, username = EXCLUDED.username, is_active = EXCLUDED.is_active;

  ---------------------------------------------------------------------
  -- 4. Academic year, grade level, section
  ---------------------------------------------------------------------
  INSERT INTO public.academic_years (school_id, name, start_date, end_date, is_current, is_active)
  VALUES (v_school_id, '2026-2027', '2026-08-01', '2027-06-30', true, true)
  RETURNING id INTO v_academic_year_id;

  INSERT INTO public.grade_levels (school_id, campus_id, name, order_index, base_fee, created_by)
  VALUES (v_school_id, v_school_id, 'Grade 5', 5, 5400.00, v_admin_id)
  RETURNING id INTO v_grade_level_id;

  INSERT INTO public.sections (school_id, campus_id, grade_level_id, name, capacity, created_by)
  VALUES (v_school_id, v_school_id, v_grade_level_id, 'Section A', 30, v_admin_id)
  RETURNING id INTO v_section_id;

  INSERT INTO public.grade_levels (school_id, campus_id, name, order_index, base_fee, created_by)
  VALUES (v_school_id, v_school_id, 'Grade 3', 3, 3600.00, v_admin_id)
  RETURNING id INTO v_grade3_id;

  INSERT INTO public.sections (school_id, campus_id, grade_level_id, name, capacity, created_by)
  VALUES (v_school_id, v_school_id, v_grade3_id, 'Section A', 30, v_admin_id)
  RETURNING id INTO v_section3_id;

  ---------------------------------------------------------------------
  -- 5. Staff (teacher)
  ---------------------------------------------------------------------
  INSERT INTO public.staff (profile_id, school_id, employee_number, title, department, employment_type, payment_type, role, is_active, permissions, custom_fields)
  VALUES (v_teacher_id, v_school_id, 'TCH-2026-0001', 'Class Teacher', 'Academics', 'full_time', 'fixed_salary', 'teacher', true, '{}'::jsonb, '{}'::jsonb)
  RETURNING id INTO v_staff_id;

  ---------------------------------------------------------------------
  -- 6. Students — Ahmed (Grade 5) and sibling Layla (Grade 3), each with
  -- their own login
  ---------------------------------------------------------------------
  INSERT INTO public.students (profile_id, school_id, student_number, grade_level, grade_level_id, section_id, medical_info, custom_fields)
  VALUES (v_student_auth_id, v_school_id, 'STU-2026-0001', 'Grade 5', v_grade_level_id, v_section_id, '{}'::jsonb, '{}'::jsonb)
  RETURNING id INTO v_student_id;

  INSERT INTO public.students (profile_id, school_id, student_number, grade_level, grade_level_id, section_id, medical_info, custom_fields)
  VALUES (v_student2_auth_id, v_school_id, 'STU-2026-0002', 'Grade 3', v_grade3_id, v_section3_id, '{}'::jsonb, '{}'::jsonb)
  RETURNING id INTO v_student2_id;

  ---------------------------------------------------------------------
  -- 7. Parent + link to both children
  ---------------------------------------------------------------------
  INSERT INTO public.parents (profile_id, school_id, occupation, metadata, custom_fields)
  VALUES (v_parent_auth_id, v_school_id, 'Business', '{}'::jsonb, '{}'::jsonb)
  RETURNING id INTO v_parent_row_id;

  INSERT INTO public.parent_student_links (parent_id, student_id, relationship, relation_type, is_emergency_contact, is_active)
  VALUES (v_parent_row_id, v_student_id, 'Father', 'father', true, true);

  INSERT INTO public.parent_student_links (parent_id, student_id, relationship, relation_type, is_emergency_contact, is_active)
  VALUES (v_parent_row_id, v_student2_id, 'Father', 'father', true, true);

  ---------------------------------------------------------------------
  -- 8. Fee category + structures — 3 installments per grade
  ---------------------------------------------------------------------
  INSERT INTO public.fee_categories (school_id, name, code, description, is_mandatory, is_discountable, display_order, is_active)
  VALUES (v_school_id, 'Tuition Fee', 'TUITION', 'Annual tuition fee', true, true, 1, true)
  RETURNING id INTO v_fee_category_id;

  -- Grade 5 (Ahmed) — 1,800 x 3 = 5,400
  INSERT INTO public.fee_structures (school_id, academic_year, grade_level_id, fee_category_id, period_type, period_name, period_number, amount, due_date, is_active)
  VALUES (v_school_id, '2026-2027', v_grade_level_id, v_fee_category_id, 'semester', '1st Installment', 1, 1800.00, '2026-07-01', true)
  RETURNING id INTO v_fs1;

  INSERT INTO public.fee_structures (school_id, academic_year, grade_level_id, fee_category_id, period_type, period_name, period_number, amount, due_date, is_active)
  VALUES (v_school_id, '2026-2027', v_grade_level_id, v_fee_category_id, 'semester', '2nd Installment', 2, 1800.00, '2026-08-31', true)
  RETURNING id INTO v_fs2;

  INSERT INTO public.fee_structures (school_id, academic_year, grade_level_id, fee_category_id, period_type, period_name, period_number, amount, due_date, is_active)
  VALUES (v_school_id, '2026-2027', v_grade_level_id, v_fee_category_id, 'semester', '3rd Installment', 3, 1800.00, '2027-01-01', true)
  RETURNING id INTO v_fs3;

  -- Grade 3 (Layla) — 1,200 x 3 = 3,600
  INSERT INTO public.fee_structures (school_id, academic_year, grade_level_id, fee_category_id, period_type, period_name, period_number, amount, due_date, is_active)
  VALUES (v_school_id, '2026-2027', v_grade3_id, v_fee_category_id, 'semester', '1st Installment', 1, 1200.00, '2026-07-01', true)
  RETURNING id INTO v_fs1b;

  INSERT INTO public.fee_structures (school_id, academic_year, grade_level_id, fee_category_id, period_type, period_name, period_number, amount, due_date, is_active)
  VALUES (v_school_id, '2026-2027', v_grade3_id, v_fee_category_id, 'semester', '2nd Installment', 2, 1200.00, '2026-08-31', true)
  RETURNING id INTO v_fs2b;

  INSERT INTO public.fee_structures (school_id, academic_year, grade_level_id, fee_category_id, period_type, period_name, period_number, amount, due_date, is_active)
  VALUES (v_school_id, '2026-2027', v_grade3_id, v_fee_category_id, 'semester', '3rd Installment', 3, 1200.00, '2027-01-01', true)
  RETURNING id INTO v_fs3b;

  ---------------------------------------------------------------------
  -- 9. Student fee records — 1st paid, 2nd due soon, 3rd upcoming
  ---------------------------------------------------------------------
  INSERT INTO public.student_fees (school_id, student_id, fee_structure_id, academic_year, base_amount, final_amount, amount_paid, status, due_date)
  VALUES (v_school_id, v_student_id, v_fs1, '2026-2027', 1800.00, 1800.00, 1800.00, 'paid', '2026-07-01')
  RETURNING id INTO v_sf1;

  INSERT INTO public.student_fees (school_id, student_id, fee_structure_id, academic_year, base_amount, final_amount, amount_paid, status, due_date)
  VALUES (v_school_id, v_student_id, v_fs2, '2026-2027', 1800.00, 1800.00, 0, 'pending', '2026-08-31')
  RETURNING id INTO v_sf2;

  INSERT INTO public.student_fees (school_id, student_id, fee_structure_id, academic_year, base_amount, final_amount, amount_paid, status, due_date)
  VALUES (v_school_id, v_student_id, v_fs3, '2026-2027', 1800.00, 1800.00, 0, 'pending', '2027-01-01')
  RETURNING id INTO v_sf3;

  -- Payment against the 1st installment (a trigger recomputes student_fees
  -- amount_paid/status from this, matching what we already set above)
  INSERT INTO public.fee_payments (school_id, student_fee_id, amount, payment_method, payment_date, received_by)
  VALUES (v_school_id, v_sf1, 1800.00, 'cash', '2026-07-01', v_admin_id);

  -- Layla (Grade 3) — same pattern, smaller amounts
  INSERT INTO public.student_fees (school_id, student_id, fee_structure_id, academic_year, base_amount, final_amount, amount_paid, status, due_date)
  VALUES (v_school_id, v_student2_id, v_fs1b, '2026-2027', 1200.00, 1200.00, 1200.00, 'paid', '2026-07-01')
  RETURNING id INTO v_sf1b;

  INSERT INTO public.student_fees (school_id, student_id, fee_structure_id, academic_year, base_amount, final_amount, amount_paid, status, due_date)
  VALUES (v_school_id, v_student2_id, v_fs2b, '2026-2027', 1200.00, 1200.00, 0, 'pending', '2026-08-31')
  RETURNING id INTO v_sf2b;

  INSERT INTO public.student_fees (school_id, student_id, fee_structure_id, academic_year, base_amount, final_amount, amount_paid, status, due_date)
  VALUES (v_school_id, v_student2_id, v_fs3b, '2026-2027', 1200.00, 1200.00, 0, 'pending', '2027-01-01')
  RETURNING id INTO v_sf3b;

  INSERT INTO public.fee_payments (school_id, student_fee_id, amount, payment_method, payment_date, received_by)
  VALUES (v_school_id, v_sf1b, 1200.00, 'cash', '2026-07-01', v_admin_id);

  ---------------------------------------------------------------------
  -- 10. School settings — currency + active plugins/modules
  ---------------------------------------------------------------------
  BEGIN
    INSERT INTO public.school_settings (school_id, campus_id, default_currency, active_plugins)
    VALUES (
      v_school_id, NULL, 'LYD',
      jsonb_build_object(
        'automatic_attendance', true,
        'discipline_score', true,
        'calendar_schedule_view', true,
        'icalendar', true,
        'relatives', true,
        'previous_next_student', true,
        'two_factor_auth', false,
        'setup_assistant', true,
        'marking_period_groups', true,
        'grading_scale_generation', true,
        'assignment_max_points', true
      )
    );
    RAISE NOTICE '✅ Section 10 (school_settings/plugins) done';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️  Section 10 (school_settings/plugins) skipped: %', SQLERRM;
  END;

  ---------------------------------------------------------------------
  -- 11. Subjects (Grade 5)
  ---------------------------------------------------------------------
  BEGIN
    INSERT INTO public.subjects (school_id, grade_level_id, name, code, subject_type, created_by)
    VALUES (v_school_id, v_grade_level_id, 'Mathematics', 'MATH5', 'theory', v_admin_id)
    RETURNING id INTO v_subject_math_id;

    INSERT INTO public.subjects (school_id, grade_level_id, name, code, subject_type, created_by)
    VALUES (v_school_id, v_grade_level_id, 'Science', 'SCI5', 'theory', v_admin_id)
    RETURNING id INTO v_subject_sci_id;

    INSERT INTO public.subjects (school_id, grade_level_id, name, code, subject_type, created_by)
    VALUES (v_school_id, v_grade_level_id, 'English', 'ENG5', 'theory', v_admin_id)
    RETURNING id INTO v_subject_eng_id;
    RAISE NOTICE '✅ Section 11 (subjects) done';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️  Section 11 (subjects) skipped: %', SQLERRM;
  END;

  ---------------------------------------------------------------------
  -- 12. Marking periods — 2 semesters for 2026-2027
  ---------------------------------------------------------------------
  BEGIN
    INSERT INTO public.marking_periods (school_id, campus_id, mp_type, title, short_name, sort_order, does_grades, start_date, end_date, is_active)
    VALUES (v_school_id, v_school_id, 'semester', 'Semester 1', 'S1', 1, true, '2026-08-01', '2026-12-31', true)
    RETURNING id INTO v_mp1_id;

    INSERT INTO public.marking_periods (school_id, campus_id, mp_type, title, short_name, sort_order, does_grades, start_date, end_date, is_active)
    VALUES (v_school_id, v_school_id, 'semester', 'Semester 2', 'S2', 2, true, '2027-01-01', '2027-06-30', true)
    RETURNING id INTO v_mp2_id;
    RAISE NOTICE '✅ Section 12 (marking periods) done';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️  Section 12 (marking periods) skipped: %', SQLERRM;
  END;

  ---------------------------------------------------------------------
  -- 13. Courses + course periods (Grade 5, taught by Sara Ali)
  ---------------------------------------------------------------------
  BEGIN
    INSERT INTO public.courses (school_id, campus_id, subject_id, name, title, short_name, academic_year_id, credit_hours, created_by)
    VALUES (v_school_id, v_school_id, v_subject_math_id, 'Mathematics 5', 'Mathematics 5', 'MATH5', v_academic_year_id, 1.0, v_admin_id)
    RETURNING id INTO v_course_math_id;

    INSERT INTO public.courses (school_id, campus_id, subject_id, name, title, short_name, academic_year_id, credit_hours, created_by)
    VALUES (v_school_id, v_school_id, v_subject_sci_id, 'Science 5', 'Science 5', 'SCI5', v_academic_year_id, 1.0, v_admin_id)
    RETURNING id INTO v_course_sci_id;

    INSERT INTO public.courses (school_id, campus_id, subject_id, name, title, short_name, academic_year_id, credit_hours, created_by)
    VALUES (v_school_id, v_school_id, v_subject_eng_id, 'English 5', 'English 5', 'ENG5', v_academic_year_id, 1.0, v_admin_id)
    RETURNING id INTO v_course_eng_id;

    INSERT INTO public.course_periods (school_id, campus_id, course_id, teacher_id, section_id, marking_period_id, title, short_name, takes_attendance, does_honor_roll, academic_year_id, created_by)
    VALUES (v_school_id, v_school_id, v_course_math_id, v_staff_id, v_section_id, v_mp1_id, 'Mathematics 5 - P1', 'P1', true, true, v_academic_year_id, v_admin_id);

    INSERT INTO public.course_periods (school_id, campus_id, course_id, teacher_id, section_id, marking_period_id, title, short_name, takes_attendance, does_honor_roll, academic_year_id, created_by)
    VALUES (v_school_id, v_school_id, v_course_sci_id, v_staff_id, v_section_id, v_mp1_id, 'Science 5 - P1', 'P1', true, true, v_academic_year_id, v_admin_id);

    INSERT INTO public.course_periods (school_id, campus_id, course_id, teacher_id, section_id, marking_period_id, title, short_name, takes_attendance, does_honor_roll, academic_year_id, created_by)
    VALUES (v_school_id, v_school_id, v_course_eng_id, v_staff_id, v_section_id, v_mp1_id, 'English 5 - P1', 'P1', true, true, v_academic_year_id, v_admin_id);
    RAISE NOTICE '✅ Section 13 (courses/course periods) done';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️  Section 13 (courses/course periods) skipped: %', SQLERRM;
  END;

  ---------------------------------------------------------------------
  -- 14. Attendance — last 10 school days for Ahmed (mostly present)
  ---------------------------------------------------------------------
  BEGIN
    FOR v_day IN SELECT generate_series('2026-08-03'::date, '2026-08-14'::date, '1 day')::date LOOP
      IF EXTRACT(ISODOW FROM v_day) NOT IN (6, 7) THEN -- skip weekends
        INSERT INTO public.attendance_records (student_id, attendance_date, status, auto_generated, marked_by)
        VALUES (
          v_student_id, v_day,
          CASE
            WHEN v_day = '2026-08-05' THEN 'absent'
            WHEN v_day = '2026-08-11' THEN 'late'
            ELSE 'present'
          END,
          false, v_teacher_id
        );
      END IF;
    END LOOP;
    RAISE NOTICE '✅ Section 14 (attendance) done';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️  Section 14 (attendance) skipped: %', SQLERRM;
  END;

  ---------------------------------------------------------------------
  -- 15. Exam + result for Ahmed
  ---------------------------------------------------------------------
  BEGIN
    INSERT INTO public.exam_types (school_id, name, description, weightage, is_active)
    VALUES (v_school_id, 'Midterm Exam', 'Mid-semester assessment', 30, true)
    RETURNING id INTO v_exam_type_id;

    INSERT INTO public.exams (school_id, exam_type_id, academic_year_id, section_id, subject_id, teacher_id, exam_name, exam_date, duration_minutes, max_marks, passing_marks, is_published, is_completed)
    VALUES (v_school_id, v_exam_type_id, v_academic_year_id, v_section_id, v_subject_math_id, v_staff_id, 'Mathematics Midterm', '2026-08-10', 90, 100, 40, true, true)
    RETURNING id INTO v_exam_id;

    INSERT INTO public.exam_results (school_id, exam_id, student_id, marks_obtained, is_absent, grade, marked_by)
    VALUES (v_school_id, v_exam_id, v_student_id, 85, false, 'A', v_teacher_id);
    RAISE NOTICE '✅ Section 15 (exam/result) done';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️  Section 15 (exam/result) skipped: %', SQLERRM;
  END;

  ---------------------------------------------------------------------
  -- 16. Library books
  ---------------------------------------------------------------------
  BEGIN
    INSERT INTO public.library_books (school_id, title, author, isbn, category_id, total_copies, available_copies)
    VALUES (v_school_id, 'Charlotte''s Web', 'E. B. White', '9780064400558', NULL, 3, 3);

    INSERT INTO public.library_books (school_id, title, author, isbn, category_id, total_copies, available_copies)
    VALUES (v_school_id, 'Matilda', 'Roald Dahl', '9780142410370', NULL, 2, 2);

    INSERT INTO public.library_books (school_id, title, author, isbn, category_id, total_copies, available_copies)
    VALUES (v_school_id, 'The Elements of Style', 'William Strunk Jr.', '9780205309023', NULL, 2, 2);
    RAISE NOTICE '✅ Section 16 (library books) done';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️  Section 16 (library books) skipped: %', SQLERRM;
  END;

  ---------------------------------------------------------------------
  -- 17. School calendar events
  ---------------------------------------------------------------------
  BEGIN
    INSERT INTO public.school_events (school_id, title, description, category, start_at, end_at, is_all_day, visible_to_roles, created_by)
    VALUES (v_school_id, 'Parent-Teacher Meeting', 'Term 1 parent-teacher conferences', 'meeting', '2026-09-15 09:00:00+00', '2026-09-15 14:00:00+00', false, ARRAY['admin','teacher','parent']::text[], v_admin_id);

    INSERT INTO public.school_events (school_id, title, description, category, start_at, end_at, is_all_day, visible_to_roles, created_by)
    VALUES (v_school_id, 'Annual Sports Day', 'Inter-house sports competition', 'activity', '2026-10-05 08:00:00+00', '2026-10-05 16:00:00+00', false, ARRAY['admin','teacher','student','parent']::text[], v_admin_id);

    INSERT INTO public.school_events (school_id, title, description, category, start_at, end_at, is_all_day, visible_to_roles, created_by)
    VALUES (v_school_id, 'Winter Break', 'School closed for winter holidays', 'holiday', '2026-12-20 00:00:00+00', '2027-01-02 23:59:59+00', true, ARRAY['admin','teacher','student','parent']::text[], v_admin_id);
    RAISE NOTICE '✅ Section 17 (school events) done';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️  Section 17 (school events) skipped: %', SQLERRM;
  END;

  RAISE NOTICE '✅ Seed complete — school_id=%, student_id=%, student2_id=%, parent_id=%', v_school_id, v_student_id, v_student2_id, v_parent_row_id;
  RAISE NOTICE 'Login with any of these (password 123123123):';
  RAISE NOTICE '  admin:   faizanhashmi603+school@gmail.com';
  RAISE NOTICE '  teacher: faizanhashmi603+teacher@gmail.com';
  RAISE NOTICE '  student: faizanhashmi603+student@gmail.com  (Ahmed, Grade 5)';
  RAISE NOTICE '  student: faizanhashmi603+student2@gmail.com (Layla, Grade 3)';
  RAISE NOTICE '  parent:  faizanhashmi603+parent@gmail.com   (sees Ahmed + Layla)';
END $$;

DROP FUNCTION IF EXISTS public.__seed_create_auth_user(text, text, text, text, text);
