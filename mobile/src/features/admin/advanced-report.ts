import type { ReportRole } from '@studently/api-client';

/** Standard columns per role (web: ROLE_CONFIGS in /admin/students/advanced-report). */
export const REPORT_FIELDS: Record<ReportRole, string[]> = {
  student: ['student_number', 'first_name', 'last_name', 'father_name', 'grandfather_name', 'email', 'phone', 'grade_level_name', 'section_name', 'is_active', 'confidential_family_status', 'siblings', 'created_at', 'miqat_qr', 'username', 'password'],
  teacher: ['employee_number', 'first_name', 'last_name', 'email', 'phone', 'title', 'department', 'qualifications', 'date_of_joining', 'employment_type', 'is_active', 'created_at', 'miqat_qr', 'username', 'password'],
  staff: ['employee_number', 'first_name', 'last_name', 'email', 'phone', 'title', 'department', 'qualifications', 'date_of_joining', 'employment_type', 'is_active', 'created_at', 'miqat_qr', 'username', 'password'],
  librarian: ['employee_number', 'first_name', 'last_name', 'email', 'phone', 'title', 'department', 'date_of_joining', 'employment_type', 'is_active', 'created_at', 'miqat_qr', 'username', 'password'],
  parent: ['first_name', 'last_name', 'email', 'phone', 'linked_students', 'is_active', 'confidential_family_status', 'created_at', 'miqat_qr', 'username', 'password'],
};
export const REPORT_ENTITY: Partial<Record<ReportRole, 'student' | 'teacher' | 'staff' | 'parent'>> = { student: 'student', teacher: 'teacher', staff: 'staff', parent: 'parent' };
