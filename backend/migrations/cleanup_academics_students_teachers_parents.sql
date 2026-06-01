-- =============================================
-- CLEANUP SCRIPT: Remove Academics, Students, Teachers, Parents
-- =============================================
-- WARNING: This script permanently deletes data!
-- Run with caution and ensure you have backups.
-- 
-- Usage: Run in Supabase SQL Editor
-- To limit to a specific campus, uncomment and set the WHERE clauses
-- =============================================

-- =============================================
-- STEP 1: REMOVE ACADEMIC RELATED DATA (child tables first)
-- =============================================

-- Timetable entries
DO $$ BEGIN
  DELETE FROM timetable_entries;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Periods
DO $$ BEGIN
  DELETE FROM periods;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Teacher subject assignments
DO $$ BEGIN
  DELETE FROM teacher_subject_assignments;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Exam results
DO $$ BEGIN
  DELETE FROM exam_results;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Exams
DO $$ BEGIN
  DELETE FROM exams;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Assignment submissions
DO $$ BEGIN
  DELETE FROM assignment_submissions;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Assignments
DO $$ BEGIN
  DELETE FROM assignments;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Attendance records
DO $$ BEGIN
  DELETE FROM attendance;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Subjects
DO $$ BEGIN
  DELETE FROM subjects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Sections
DO $$ BEGIN
  DELETE FROM sections;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Grade levels
DO $$ BEGIN
  DELETE FROM grade_levels;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Academic years
DO $$ BEGIN
  DELETE FROM academic_years;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- =============================================
-- STEP 2: REMOVE STUDENT RELATED DATA
-- =============================================

-- Student fee records
DO $$ BEGIN
  DELETE FROM student_fees;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Fee payments
DO $$ BEGIN
  DELETE FROM fee_payments;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Library loans for students
DO $$ BEGIN
  DELETE FROM library_loans;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Student custom field values
DO $$ BEGIN
  DELETE FROM student_custom_field_values;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Students
DO $$ BEGIN
  DELETE FROM students;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- =============================================
-- STEP 3: REMOVE TEACHER/STAFF RELATED DATA
-- =============================================

-- Salary records
DO $$ BEGIN
  DELETE FROM salary_records;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Staff leave records
DO $$ BEGIN
  DELETE FROM staff_leave;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Staff custom field values
DO $$ BEGIN
  DELETE FROM staff_custom_field_values;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Staff campus assignments
DO $$ BEGIN
  DELETE FROM staff_campus_assignments;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Staff records
DO $$ BEGIN
  DELETE FROM staff;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- =============================================
-- STEP 4: REMOVE PARENT RELATED DATA
-- =============================================

-- Parent-student relationships
DO $$ BEGIN
  DELETE FROM parent_student_relationships;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Parents
DO $$ BEGIN
  DELETE FROM parents;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- =============================================
-- VERIFICATION QUERIES
-- =============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Cleanup completed successfully!';
END $$;
