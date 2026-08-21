-- =====================================================================
-- DUMMY DATA SEED — MORE STUDENTS & PARENTS
-- Run this AFTER seed_dummy_data_faizanhashmi603.sql (it looks up the
-- school created there by slug — it does not create a school itself).
--
-- Adds 4 more students across 4 new grade levels, 3 more parent accounts
-- (one parent with two children), full fee installment histories in a
-- mix of statuses (paid / partial / overdue / pending), and a little
-- attendance history for each — so admin lists, parent dashboards, and
-- the Fee Payment Timeline all have a realistic variety of records.
--
-- New logins (password 123123123 for all):
--   Parent   faizanhashmi603+parent2@gmail.com   (Khalid Omar — father of Omar & Yusuf)
--   Student  faizanhashmi603+student3@gmail.com  (Omar Khalid,  Grade 1 — 1 installment overdue)
--   Student  faizanhashmi603+student4@gmail.com  (Yusuf Khalid, Grade 4 — 1 installment partially paid)
--   Parent   faizanhashmi603+parent3@gmail.com   (Amina Saleh — mother of Mariam)
--   Student  faizanhashmi603+student5@gmail.com  (Mariam Saleh, Grade 2 — fully paid)
--   Parent   faizanhashmi603+parent4@gmail.com   (Fahad Nasser — father of Zainab)
--   Student  faizanhashmi603+student6@gmail.com  (Zainab Nasser, Grade 6 — normal 1 paid/2 pending)
--
-- Safe to re-run: exits early if faizanhashmi603+student3@gmail.com already exists.
--
-- Each numbered section below is wrapped in its own BEGIN/EXCEPTION block
-- so one unexpected column name doesn't roll back everything else.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Same helper as the first seed script (recreated here since it was
-- dropped at the end of that run).
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

DO $$
DECLARE
  v_school_id        uuid;
  v_academic_year_id uuid;
  v_admin_id         uuid;
  v_fee_category_id  uuid;

  -- Grade levels + sections (new)
  v_grade1_id uuid; v_section1_id uuid;
  v_grade2_id uuid; v_section2_id uuid;
  v_grade4_id uuid; v_section4_id uuid;
  v_grade6_id uuid; v_section6_id uuid;

  -- Parents
  v_parent2_auth_id uuid; v_parent2_row_id uuid; -- Khalid Omar (father of Omar & Yusuf)
  v_parent3_auth_id uuid; v_parent3_row_id uuid; -- Amina Saleh (mother of Mariam)
  v_parent4_auth_id uuid; v_parent4_row_id uuid; -- Fahad Nasser (father of Zainab)

  -- Students
  v_omar_auth_id  uuid; v_omar_id  uuid; -- Grade 1
  v_yusuf_auth_id uuid; v_yusuf_id uuid; -- Grade 4
  v_mariam_auth_id uuid; v_mariam_id uuid; -- Grade 2
  v_zainab_auth_id uuid; v_zainab_id uuid; -- Grade 6

  -- Fee structures per grade (1st/2nd/3rd installment)
  v_fs1_g1 uuid; v_fs2_g1 uuid; v_fs3_g1 uuid;
  v_fs1_g2 uuid; v_fs2_g2 uuid; v_fs3_g2 uuid;
  v_fs1_g4 uuid; v_fs2_g4 uuid; v_fs3_g4 uuid;
  v_fs1_g6 uuid; v_fs2_g6 uuid; v_fs3_g6 uuid;

  v_sf uuid; -- scratch var reused for each student_fees insert
  v_student_id uuid; -- scratch var reused in the attendance loop
  v_day date;
BEGIN
  -- Requires the first seed script to have run already
  SELECT id INTO v_school_id FROM public.schools WHERE slug = 'al-noor-international';
  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'School "al-noor-international" not found — run seed_dummy_data_faizanhashmi603.sql first.';
  END IF;

  -- Bail out if this seed already ran
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'faizanhashmi603+student3@gmail.com') THEN
    RAISE NOTICE 'Seed already applied (faizanhashmi603+student3@gmail.com exists) — skipping.';
    RETURN;
  END IF;

  SELECT id INTO v_academic_year_id FROM public.academic_years WHERE school_id = v_school_id AND name = '2026-2027';
  SELECT id INTO v_admin_id FROM public.profiles WHERE school_id = v_school_id AND email = 'faizanhashmi603+school@gmail.com';
  SELECT id INTO v_fee_category_id FROM public.fee_categories WHERE school_id = v_school_id AND code = 'TUITION';

  ---------------------------------------------------------------------
  -- 1. New grade levels + sections
  ---------------------------------------------------------------------
  INSERT INTO public.grade_levels (school_id, campus_id, name, order_index, base_fee, created_by)
  VALUES (v_school_id, v_school_id, 'Grade 1', 1, 3000.00, v_admin_id) RETURNING id INTO v_grade1_id;
  INSERT INTO public.sections (school_id, campus_id, grade_level_id, name, capacity, created_by)
  VALUES (v_school_id, v_school_id, v_grade1_id, 'Section A', 30, v_admin_id) RETURNING id INTO v_section1_id;

  INSERT INTO public.grade_levels (school_id, campus_id, name, order_index, base_fee, created_by)
  VALUES (v_school_id, v_school_id, 'Grade 2', 2, 3300.00, v_admin_id) RETURNING id INTO v_grade2_id;
  INSERT INTO public.sections (school_id, campus_id, grade_level_id, name, capacity, created_by)
  VALUES (v_school_id, v_school_id, v_grade2_id, 'Section A', 30, v_admin_id) RETURNING id INTO v_section2_id;

  INSERT INTO public.grade_levels (school_id, campus_id, name, order_index, base_fee, created_by)
  VALUES (v_school_id, v_school_id, 'Grade 4', 4, 3900.00, v_admin_id) RETURNING id INTO v_grade4_id;
  INSERT INTO public.sections (school_id, campus_id, grade_level_id, name, capacity, created_by)
  VALUES (v_school_id, v_school_id, v_grade4_id, 'Section A', 30, v_admin_id) RETURNING id INTO v_section4_id;

  INSERT INTO public.grade_levels (school_id, campus_id, name, order_index, base_fee, created_by)
  VALUES (v_school_id, v_school_id, 'Grade 6', 6, 4500.00, v_admin_id) RETURNING id INTO v_grade6_id;
  INSERT INTO public.sections (school_id, campus_id, grade_level_id, name, capacity, created_by)
  VALUES (v_school_id, v_school_id, v_grade6_id, 'Section A', 30, v_admin_id) RETURNING id INTO v_section6_id;

  ---------------------------------------------------------------------
  -- 2. Fee structures — 3 installments per new grade (same due dates
  -- as the first seed: 2026-07-01 / 2026-08-31 / 2027-01-01)
  ---------------------------------------------------------------------
  INSERT INTO public.fee_structures (school_id, academic_year, grade_level_id, fee_category_id, period_type, period_name, period_number, amount, due_date, is_active)
  VALUES (v_school_id, '2026-2027', v_grade1_id, v_fee_category_id, 'semester', '1st Installment', 1, 1000.00, '2026-07-01', true) RETURNING id INTO v_fs1_g1;
  INSERT INTO public.fee_structures (school_id, academic_year, grade_level_id, fee_category_id, period_type, period_name, period_number, amount, due_date, is_active)
  VALUES (v_school_id, '2026-2027', v_grade1_id, v_fee_category_id, 'semester', '2nd Installment', 2, 1000.00, '2026-08-31', true) RETURNING id INTO v_fs2_g1;
  INSERT INTO public.fee_structures (school_id, academic_year, grade_level_id, fee_category_id, period_type, period_name, period_number, amount, due_date, is_active)
  VALUES (v_school_id, '2026-2027', v_grade1_id, v_fee_category_id, 'semester', '3rd Installment', 3, 1000.00, '2027-01-01', true) RETURNING id INTO v_fs3_g1;

  INSERT INTO public.fee_structures (school_id, academic_year, grade_level_id, fee_category_id, period_type, period_name, period_number, amount, due_date, is_active)
  VALUES (v_school_id, '2026-2027', v_grade2_id, v_fee_category_id, 'semester', '1st Installment', 1, 1100.00, '2026-07-01', true) RETURNING id INTO v_fs1_g2;
  INSERT INTO public.fee_structures (school_id, academic_year, grade_level_id, fee_category_id, period_type, period_name, period_number, amount, due_date, is_active)
  VALUES (v_school_id, '2026-2027', v_grade2_id, v_fee_category_id, 'semester', '2nd Installment', 2, 1100.00, '2026-08-31', true) RETURNING id INTO v_fs2_g2;
  INSERT INTO public.fee_structures (school_id, academic_year, grade_level_id, fee_category_id, period_type, period_name, period_number, amount, due_date, is_active)
  VALUES (v_school_id, '2026-2027', v_grade2_id, v_fee_category_id, 'semester', '3rd Installment', 3, 1100.00, '2027-01-01', true) RETURNING id INTO v_fs3_g2;

  INSERT INTO public.fee_structures (school_id, academic_year, grade_level_id, fee_category_id, period_type, period_name, period_number, amount, due_date, is_active)
  VALUES (v_school_id, '2026-2027', v_grade4_id, v_fee_category_id, 'semester', '1st Installment', 1, 1300.00, '2026-07-01', true) RETURNING id INTO v_fs1_g4;
  INSERT INTO public.fee_structures (school_id, academic_year, grade_level_id, fee_category_id, period_type, period_name, period_number, amount, due_date, is_active)
  VALUES (v_school_id, '2026-2027', v_grade4_id, v_fee_category_id, 'semester', '2nd Installment', 2, 1300.00, '2026-08-31', true) RETURNING id INTO v_fs2_g4;
  INSERT INTO public.fee_structures (school_id, academic_year, grade_level_id, fee_category_id, period_type, period_name, period_number, amount, due_date, is_active)
  VALUES (v_school_id, '2026-2027', v_grade4_id, v_fee_category_id, 'semester', '3rd Installment', 3, 1300.00, '2027-01-01', true) RETURNING id INTO v_fs3_g4;

  INSERT INTO public.fee_structures (school_id, academic_year, grade_level_id, fee_category_id, period_type, period_name, period_number, amount, due_date, is_active)
  VALUES (v_school_id, '2026-2027', v_grade6_id, v_fee_category_id, 'semester', '1st Installment', 1, 1500.00, '2026-07-01', true) RETURNING id INTO v_fs1_g6;
  INSERT INTO public.fee_structures (school_id, academic_year, grade_level_id, fee_category_id, period_type, period_name, period_number, amount, due_date, is_active)
  VALUES (v_school_id, '2026-2027', v_grade6_id, v_fee_category_id, 'semester', '2nd Installment', 2, 1500.00, '2026-08-31', true) RETURNING id INTO v_fs2_g6;
  INSERT INTO public.fee_structures (school_id, academic_year, grade_level_id, fee_category_id, period_type, period_name, period_number, amount, due_date, is_active)
  VALUES (v_school_id, '2026-2027', v_grade6_id, v_fee_category_id, 'semester', '3rd Installment', 3, 1500.00, '2027-01-01', true) RETURNING id INTO v_fs3_g6;

  ---------------------------------------------------------------------
  -- 3. Parents (auth + profile + parents row)
  ---------------------------------------------------------------------
  v_parent2_auth_id := public.__seed_create_auth_user('faizanhashmi603+parent2@gmail.com', '123123123', 'Khalid', 'Omar', 'parent');
  INSERT INTO public.profiles (id, school_id, role, first_name, last_name, email, username, is_active)
  VALUES (v_parent2_auth_id, v_school_id, 'parent', 'Khalid', 'Omar', 'faizanhashmi603+parent2@gmail.com', 'khalid.omar', true)
  ON CONFLICT (id) DO UPDATE SET school_id = EXCLUDED.school_id, role = EXCLUDED.role, first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name, email = EXCLUDED.email, username = EXCLUDED.username, is_active = EXCLUDED.is_active;
  INSERT INTO public.parents (profile_id, school_id, occupation, metadata, custom_fields)
  VALUES (v_parent2_auth_id, v_school_id, 'Engineer', '{}'::jsonb, '{}'::jsonb) RETURNING id INTO v_parent2_row_id;

  v_parent3_auth_id := public.__seed_create_auth_user('faizanhashmi603+parent3@gmail.com', '123123123', 'Amina', 'Saleh', 'parent');
  INSERT INTO public.profiles (id, school_id, role, first_name, last_name, email, username, is_active)
  VALUES (v_parent3_auth_id, v_school_id, 'parent', 'Amina', 'Saleh', 'faizanhashmi603+parent3@gmail.com', 'amina.saleh', true)
  ON CONFLICT (id) DO UPDATE SET school_id = EXCLUDED.school_id, role = EXCLUDED.role, first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name, email = EXCLUDED.email, username = EXCLUDED.username, is_active = EXCLUDED.is_active;
  INSERT INTO public.parents (profile_id, school_id, occupation, metadata, custom_fields)
  VALUES (v_parent3_auth_id, v_school_id, 'Doctor', '{}'::jsonb, '{}'::jsonb) RETURNING id INTO v_parent3_row_id;

  v_parent4_auth_id := public.__seed_create_auth_user('faizanhashmi603+parent4@gmail.com', '123123123', 'Fahad', 'Nasser', 'parent');
  INSERT INTO public.profiles (id, school_id, role, first_name, last_name, email, username, is_active)
  VALUES (v_parent4_auth_id, v_school_id, 'parent', 'Fahad', 'Nasser', 'faizanhashmi603+parent4@gmail.com', 'fahad.nasser', true)
  ON CONFLICT (id) DO UPDATE SET school_id = EXCLUDED.school_id, role = EXCLUDED.role, first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name, email = EXCLUDED.email, username = EXCLUDED.username, is_active = EXCLUDED.is_active;
  INSERT INTO public.parents (profile_id, school_id, occupation, metadata, custom_fields)
  VALUES (v_parent4_auth_id, v_school_id, 'Business', '{}'::jsonb, '{}'::jsonb) RETURNING id INTO v_parent4_row_id;

  ---------------------------------------------------------------------
  -- 4. Students (auth + profile + students row), linked to parents
  ---------------------------------------------------------------------
  v_omar_auth_id := public.__seed_create_auth_user('faizanhashmi603+student3@gmail.com', '123123123', 'Omar', 'Khalid', 'student');
  INSERT INTO public.profiles (id, school_id, role, first_name, last_name, email, username, gender, date_of_birth, is_active)
  VALUES (v_omar_auth_id, v_school_id, 'student', 'Omar', 'Khalid', 'faizanhashmi603+student3@gmail.com', 'omar.khalid', 'male', '2019-03-12', true)
  ON CONFLICT (id) DO UPDATE SET school_id = EXCLUDED.school_id, role = EXCLUDED.role, first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name, email = EXCLUDED.email, username = EXCLUDED.username, gender = EXCLUDED.gender,
    date_of_birth = EXCLUDED.date_of_birth, is_active = EXCLUDED.is_active;
  INSERT INTO public.students (profile_id, school_id, student_number, grade_level, grade_level_id, section_id, medical_info, custom_fields)
  VALUES (v_omar_auth_id, v_school_id, 'STU-2026-0003', 'Grade 1', v_grade1_id, v_section1_id, '{}'::jsonb, '{}'::jsonb) RETURNING id INTO v_omar_id;
  INSERT INTO public.parent_student_links (parent_id, student_id, relationship, relation_type, is_emergency_contact, is_active)
  VALUES (v_parent2_row_id, v_omar_id, 'Father', 'father', true, true);

  v_yusuf_auth_id := public.__seed_create_auth_user('faizanhashmi603+student4@gmail.com', '123123123', 'Yusuf', 'Khalid', 'student');
  INSERT INTO public.profiles (id, school_id, role, first_name, last_name, email, username, gender, date_of_birth, is_active)
  VALUES (v_yusuf_auth_id, v_school_id, 'student', 'Yusuf', 'Khalid', 'faizanhashmi603+student4@gmail.com', 'yusuf.khalid', 'male', '2016-11-02', true)
  ON CONFLICT (id) DO UPDATE SET school_id = EXCLUDED.school_id, role = EXCLUDED.role, first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name, email = EXCLUDED.email, username = EXCLUDED.username, gender = EXCLUDED.gender,
    date_of_birth = EXCLUDED.date_of_birth, is_active = EXCLUDED.is_active;
  INSERT INTO public.students (profile_id, school_id, student_number, grade_level, grade_level_id, section_id, medical_info, custom_fields)
  VALUES (v_yusuf_auth_id, v_school_id, 'STU-2026-0004', 'Grade 4', v_grade4_id, v_section4_id, '{}'::jsonb, '{}'::jsonb) RETURNING id INTO v_yusuf_id;
  INSERT INTO public.parent_student_links (parent_id, student_id, relationship, relation_type, is_emergency_contact, is_active)
  VALUES (v_parent2_row_id, v_yusuf_id, 'Father', 'father', true, true);

  v_mariam_auth_id := public.__seed_create_auth_user('faizanhashmi603+student5@gmail.com', '123123123', 'Mariam', 'Saleh', 'student');
  INSERT INTO public.profiles (id, school_id, role, first_name, last_name, email, username, gender, date_of_birth, is_active)
  VALUES (v_mariam_auth_id, v_school_id, 'student', 'Mariam', 'Saleh', 'faizanhashmi603+student5@gmail.com', 'mariam.saleh', 'female', '2018-07-25', true)
  ON CONFLICT (id) DO UPDATE SET school_id = EXCLUDED.school_id, role = EXCLUDED.role, first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name, email = EXCLUDED.email, username = EXCLUDED.username, gender = EXCLUDED.gender,
    date_of_birth = EXCLUDED.date_of_birth, is_active = EXCLUDED.is_active;
  INSERT INTO public.students (profile_id, school_id, student_number, grade_level, grade_level_id, section_id, medical_info, custom_fields)
  VALUES (v_mariam_auth_id, v_school_id, 'STU-2026-0005', 'Grade 2', v_grade2_id, v_section2_id, '{}'::jsonb, '{}'::jsonb) RETURNING id INTO v_mariam_id;
  INSERT INTO public.parent_student_links (parent_id, student_id, relationship, relation_type, is_emergency_contact, is_active)
  VALUES (v_parent3_row_id, v_mariam_id, 'Mother', 'mother', true, true);

  v_zainab_auth_id := public.__seed_create_auth_user('faizanhashmi603+student6@gmail.com', '123123123', 'Zainab', 'Nasser', 'student');
  INSERT INTO public.profiles (id, school_id, role, first_name, last_name, email, username, gender, date_of_birth, is_active)
  VALUES (v_zainab_auth_id, v_school_id, 'student', 'Zainab', 'Nasser', 'faizanhashmi603+student6@gmail.com', 'zainab.nasser', 'female', '2014-09-30', true)
  ON CONFLICT (id) DO UPDATE SET school_id = EXCLUDED.school_id, role = EXCLUDED.role, first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name, email = EXCLUDED.email, username = EXCLUDED.username, gender = EXCLUDED.gender,
    date_of_birth = EXCLUDED.date_of_birth, is_active = EXCLUDED.is_active;
  INSERT INTO public.students (profile_id, school_id, student_number, grade_level, grade_level_id, section_id, medical_info, custom_fields)
  VALUES (v_zainab_auth_id, v_school_id, 'STU-2026-0006', 'Grade 6', v_grade6_id, v_section6_id, '{}'::jsonb, '{}'::jsonb) RETURNING id INTO v_zainab_id;
  INSERT INTO public.parent_student_links (parent_id, student_id, relationship, relation_type, is_emergency_contact, is_active)
  VALUES (v_parent4_row_id, v_zainab_id, 'Father', 'father', true, true);

  ---------------------------------------------------------------------
  -- 5. Fee records — a different status mix per student
  ---------------------------------------------------------------------

  -- Omar (Grade 1): 1st installment OVERDUE (past due, unpaid), rest pending
  INSERT INTO public.student_fees (school_id, student_id, fee_structure_id, academic_year, base_amount, final_amount, amount_paid, status, due_date)
  VALUES (v_school_id, v_omar_id, v_fs1_g1, '2026-2027', 1000.00, 1000.00, 0, 'overdue', '2026-07-01');
  INSERT INTO public.student_fees (school_id, student_id, fee_structure_id, academic_year, base_amount, final_amount, amount_paid, status, due_date)
  VALUES (v_school_id, v_omar_id, v_fs2_g1, '2026-2027', 1000.00, 1000.00, 0, 'pending', '2026-08-31');
  INSERT INTO public.student_fees (school_id, student_id, fee_structure_id, academic_year, base_amount, final_amount, amount_paid, status, due_date)
  VALUES (v_school_id, v_omar_id, v_fs3_g1, '2026-2027', 1000.00, 1000.00, 0, 'pending', '2027-01-01');

  -- Yusuf (Grade 4): 1st installment PARTIALLY paid, rest pending
  INSERT INTO public.student_fees (school_id, student_id, fee_structure_id, academic_year, base_amount, final_amount, amount_paid, status, due_date)
  VALUES (v_school_id, v_yusuf_id, v_fs1_g4, '2026-2027', 1300.00, 1300.00, 650.00, 'partial', '2026-07-01') RETURNING id INTO v_sf;
  INSERT INTO public.fee_payments (school_id, student_fee_id, amount, payment_method, payment_date, received_by)
  VALUES (v_school_id, v_sf, 650.00, 'bank_transfer', '2026-07-05', v_admin_id);
  INSERT INTO public.student_fees (school_id, student_id, fee_structure_id, academic_year, base_amount, final_amount, amount_paid, status, due_date)
  VALUES (v_school_id, v_yusuf_id, v_fs2_g4, '2026-2027', 1300.00, 1300.00, 0, 'pending', '2026-08-31');
  INSERT INTO public.student_fees (school_id, student_id, fee_structure_id, academic_year, base_amount, final_amount, amount_paid, status, due_date)
  VALUES (v_school_id, v_yusuf_id, v_fs3_g4, '2026-2027', 1300.00, 1300.00, 0, 'pending', '2027-01-01');

  -- Mariam (Grade 2): all three installments PAID
  INSERT INTO public.student_fees (school_id, student_id, fee_structure_id, academic_year, base_amount, final_amount, amount_paid, status, due_date)
  VALUES (v_school_id, v_mariam_id, v_fs1_g2, '2026-2027', 1100.00, 1100.00, 1100.00, 'paid', '2026-07-01') RETURNING id INTO v_sf;
  INSERT INTO public.fee_payments (school_id, student_fee_id, amount, payment_method, payment_date, received_by)
  VALUES (v_school_id, v_sf, 1100.00, 'cash', '2026-07-01', v_admin_id);
  INSERT INTO public.student_fees (school_id, student_id, fee_structure_id, academic_year, base_amount, final_amount, amount_paid, status, due_date)
  VALUES (v_school_id, v_mariam_id, v_fs2_g2, '2026-2027', 1100.00, 1100.00, 1100.00, 'paid', '2026-08-31') RETURNING id INTO v_sf;
  INSERT INTO public.fee_payments (school_id, student_fee_id, amount, payment_method, payment_date, received_by)
  VALUES (v_school_id, v_sf, 1100.00, 'card', '2026-08-15', v_admin_id);
  INSERT INTO public.student_fees (school_id, student_id, fee_structure_id, academic_year, base_amount, final_amount, amount_paid, status, due_date)
  VALUES (v_school_id, v_mariam_id, v_fs3_g2, '2026-2027', 1100.00, 1100.00, 1100.00, 'paid', '2027-01-01') RETURNING id INTO v_sf;
  INSERT INTO public.fee_payments (school_id, student_fee_id, amount, payment_method, payment_date, received_by)
  VALUES (v_school_id, v_sf, 1100.00, 'card', '2026-08-15', v_admin_id);

  -- Zainab (Grade 6): 1st paid, 2nd due soon, 3rd upcoming (same pattern as Ahmed/Layla)
  INSERT INTO public.student_fees (school_id, student_id, fee_structure_id, academic_year, base_amount, final_amount, amount_paid, status, due_date)
  VALUES (v_school_id, v_zainab_id, v_fs1_g6, '2026-2027', 1500.00, 1500.00, 1500.00, 'paid', '2026-07-01') RETURNING id INTO v_sf;
  INSERT INTO public.fee_payments (school_id, student_fee_id, amount, payment_method, payment_date, received_by)
  VALUES (v_school_id, v_sf, 1500.00, 'cash', '2026-07-01', v_admin_id);
  INSERT INTO public.student_fees (school_id, student_id, fee_structure_id, academic_year, base_amount, final_amount, amount_paid, status, due_date)
  VALUES (v_school_id, v_zainab_id, v_fs2_g6, '2026-2027', 1500.00, 1500.00, 0, 'pending', '2026-08-31');
  INSERT INTO public.student_fees (school_id, student_id, fee_structure_id, academic_year, base_amount, final_amount, amount_paid, status, due_date)
  VALUES (v_school_id, v_zainab_id, v_fs3_g6, '2026-2027', 1500.00, 1500.00, 0, 'pending', '2027-01-01');

  ---------------------------------------------------------------------
  -- 6. A little attendance history for each new student (best-effort)
  ---------------------------------------------------------------------
  BEGIN
    FOREACH v_student_id IN ARRAY ARRAY[v_omar_id, v_yusuf_id, v_mariam_id, v_zainab_id] LOOP
      FOR v_day IN SELECT generate_series('2026-08-03'::date, '2026-08-14'::date, '1 day')::date LOOP
        IF EXTRACT(ISODOW FROM v_day) NOT IN (6, 7) THEN -- skip weekends
          INSERT INTO public.attendance_records (student_id, attendance_date, status, auto_generated, marked_by)
          VALUES (
            v_student_id, v_day,
            CASE WHEN v_day = '2026-08-06' THEN 'absent' ELSE 'present' END,
            true, v_admin_id
          );
        END IF;
      END LOOP;
    END LOOP;
    RAISE NOTICE '✅ Section 6 (attendance) done';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️  Section 6 (attendance) skipped: %', SQLERRM;
  END;

  RAISE NOTICE '✅ More students seeded — Omar (Grade1, overdue), Yusuf (Grade4, partial), Mariam (Grade2, all paid), Zainab (Grade6, normal)';
  RAISE NOTICE 'New logins (password 123123123):';
  RAISE NOTICE '  parent:  faizanhashmi603+parent2@gmail.com  (Khalid Omar — Omar + Yusuf)';
  RAISE NOTICE '  student: faizanhashmi603+student3@gmail.com (Omar Khalid, Grade 1)';
  RAISE NOTICE '  student: faizanhashmi603+student4@gmail.com (Yusuf Khalid, Grade 4)';
  RAISE NOTICE '  parent:  faizanhashmi603+parent3@gmail.com  (Amina Saleh — Mariam)';
  RAISE NOTICE '  student: faizanhashmi603+student5@gmail.com (Mariam Saleh, Grade 2)';
  RAISE NOTICE '  parent:  faizanhashmi603+parent4@gmail.com  (Fahad Nasser — Zainab)';
  RAISE NOTICE '  student: faizanhashmi603+student6@gmail.com (Zainab Nasser, Grade 6)';
END $$;

DROP FUNCTION IF EXISTS public.__seed_create_auth_user(text, text, text, text, text);
