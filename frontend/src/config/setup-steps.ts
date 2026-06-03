/**
 * Setup Assistant Steps Configuration
 *
 * Defines the guided setup steps shown to each role on their dashboard.
 * Mirrors RosarioSIS Setup_Assistant plugin with Studently-specific routes.
 *
 * Steps are grouped by category (matching sidebar sections).
 * The backend only stores completion state — step definitions live here.
 */

import {
  Building2,
  GraduationCap,
  Users,
  BookOpen,
  Clock,
  Layers,
  Calendar,
  Award,
  CalendarCheck,
  UserCheck,
  Upload,
  Settings,
  CreditCard,
  ClipboardList,
  Sliders,
  FileText,
  MessageSquare,
  Eye,
  Plus,
  Megaphone,
  type LucideIcon,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SetupStep {
  /** Unique stable identifier (used for progress tracking) */
  id: string
  /** Display text for the step */
  text: string
  /** Route to navigate to */
  href: string
}

export interface SetupStepCategory {
  /** Category title (matches sidebar section name) */
  title: string
  /** Icon for the category header */
  icon: LucideIcon
  /** Steps in this category */
  steps: SetupStep[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Steps
// ─────────────────────────────────────────────────────────────────────────────

const adminSteps: SetupStepCategory[] = [
  {
    title: 'School',
    icon: Building2,
    steps: [
      { id: 'admin_school_details', text: 'Edit School Details', href: '/admin/school-details' },
      { id: 'admin_marking_periods', text: 'Create Marking Periods', href: '/admin/marking-periods' },
      { id: 'admin_calendar', text: 'Create Calendar Events', href: '/admin/events' },
      { id: 'admin_periods', text: 'Edit Periods', href: '/admin/periods' },
      { id: 'admin_grade_levels', text: 'Edit Grade Levels', href: '/admin/academics/grades' },
      { id: 'admin_sections', text: 'Create Sections', href: '/admin/academics/sections' },
      { id: 'admin_subjects', text: 'Create Subjects', href: '/admin/academics/subjects' },
    ],
  },
  {
    title: 'Grades',
    icon: Award,
    steps: [
      { id: 'admin_grading_scales', text: 'Setup Grading Scales', href: '/admin/grades/grading-scales' },
      { id: 'admin_comment_codes', text: 'Create Comment Codes', href: '/admin/grades/comment-codes' },
      { id: 'admin_report_comments', text: 'Create Report Card Comments', href: '/admin/grades/report-card-comments' },
      { id: 'admin_grade_config', text: 'Configure Grades', href: '/admin/grades/configuration' },
    ],
  },
  {
    title: 'Attendance',
    icon: CalendarCheck,
    steps: [
      { id: 'admin_attendance_codes', text: 'Setup Attendance Codes', href: '/admin/attendance' },
    ],
  },
  {
    title: 'Students',
    icon: GraduationCap,
    steps: [
      { id: 'admin_add_student', text: 'Add a Student', href: '/admin/students/add-student' },
      { id: 'admin_import_students', text: 'Import Students', href: '/admin/students/bulk-import' },
      { id: 'admin_student_fields', text: 'Configure Student Custom Fields', href: '/admin/students/custom-fields' },
    ],
  },
  {
    title: 'Teachers',
    icon: Users,
    steps: [
      { id: 'admin_add_teacher', text: 'Add a Teacher', href: '/admin/teachers/add' },
    ],
  },
  {
    title: 'Staff',
    icon: Users,
    steps: [
      { id: 'admin_add_staff', text: 'Add Staff', href: '/admin/staff/add-staff' },
      { id: 'admin_staff_fields', text: 'Configure Staff Custom Fields', href: '/admin/staff/custom-fields' },
    ],
  },
  {
    title: 'Parents',
    icon: UserCheck,
    steps: [
      { id: 'admin_add_parent', text: 'Add a Parent', href: '/admin/parents/add-parent' },
      { id: 'admin_associate_parent', text: 'Associate Parent with Student', href: '/admin/parents/associate-parent' },
    ],
  },
  {
    title: 'Scheduling',
    icon: Layers,
    steps: [
      { id: 'admin_courses', text: 'Create Courses', href: '/admin/scheduling/courses' },
      { id: 'admin_student_schedule', text: 'Create Student Schedules', href: '/admin/scheduling/student-schedule' },
      { id: 'admin_timetable', text: 'Setup Timetable', href: '/admin/timetable' },
    ],
  },
  {
    title: 'Student Billing',
    icon: CreditCard,
    steps: [
      { id: 'admin_fee_categories', text: 'Create Fee Categories', href: '/admin/fees/fee-categories' },
      { id: 'admin_fee_structures', text: 'Setup Fee Structures', href: '/admin/fees/structures' },
      { id: 'admin_generate_fees', text: 'Generate Fees', href: '/admin/fees/generate' },
    ],
  },
  {
    title: 'Settings',
    icon: Settings,
    steps: [
      { id: 'admin_campuses', text: 'Configure Campuses', href: '/admin/settings/campuses' },
      { id: 'admin_plugins', text: 'Activate Plugins', href: '/admin/settings/plugins' },
      { id: 'admin_email_smtp', text: 'Configure Email SMTP', href: '/admin/settings/email-smtp' },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Teacher Steps
// ─────────────────────────────────────────────────────────────────────────────

const teacherSteps: SetupStepCategory[] = [
  {
    title: 'Getting Started',
    icon: Eye,
    steps: [
      { id: 'teacher_view_portal', text: 'View Portal Announcements', href: '/teacher/portal/notes' },
      { id: 'teacher_view_timetable', text: 'View Your Timetable', href: '/teacher/timetable' },
    ],
  },
  {
    title: 'Academic Management',
    icon: Clock,
    steps: [
      { id: 'teacher_take_attendance', text: 'Take Attendance', href: '/teacher/attendance' },
      { id: 'teacher_subjects', text: 'View Your Subjects', href: '/teacher/subjects' },
      { id: 'teacher_diary_write', text: 'Write Class Diary', href: '/admin/attendance/class-diary-write' },
      { id: 'teacher_lesson_plan', text: 'Add a Lesson Plan', href: '/teacher/lesson-plans' },
    ],
  },
  {
    title: 'Student Learning',
    icon: ClipboardList,
    steps: [
      { id: 'teacher_create_assignment', text: 'Create an Assignment', href: '/teacher/assignments' },
      { id: 'teacher_gradebook', text: 'Use the Gradebook', href: '/teacher/grades/gradebook' },
      { id: 'teacher_report_cards', text: 'View Report Cards', href: '/teacher/grades/report-cards' },
    ],
  },
  {
    title: 'Resources',
    icon: Upload,
    steps: [
      { id: 'teacher_upload_resource', text: 'Upload a Learning Resource', href: '/teacher/learning-resources' },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Student Steps
// ─────────────────────────────────────────────────────────────────────────────

const studentSteps: SetupStepCategory[] = [
  {
    title: 'Getting Started',
    icon: Eye,
    steps: [
      { id: 'student_view_portal', text: 'View Portal Announcements', href: '/student/portal/notes' },
      { id: 'student_view_profile', text: 'Review Your Profile', href: '/student/profile' },
    ],
  },
  {
    title: 'My Classes',
    icon: BookOpen,
    steps: [
      { id: 'student_view_timetable', text: 'Check Your Timetable', href: '/student/timetable' },
      { id: 'student_view_attendance', text: 'View Attendance Record', href: '/student/attendance' },
    ],
  },
  {
    title: 'Work & Grades',
    icon: ClipboardList,
    steps: [
      { id: 'student_view_assignments', text: 'Check Assignments', href: '/student/assignments' },
      { id: 'student_view_report_cards', text: 'View Report Cards', href: '/student/grades/report-cards' },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Parent Steps
// ─────────────────────────────────────────────────────────────────────────────

const parentSteps: SetupStepCategory[] = [
  {
    title: 'Getting Started',
    icon: Eye,
    steps: [
      { id: 'parent_view_portal', text: 'View Portal Announcements', href: '/parent/portal/notes' },
      { id: 'parent_view_academics', text: 'View Child\'s Academics', href: '/parent/academics' },
    ],
  },
  {
    title: 'Monitor Your Child',
    icon: CalendarCheck,
    steps: [
      { id: 'parent_view_attendance', text: 'Check Attendance', href: '/parent/attendance' },
      { id: 'parent_view_homework', text: 'View Homework', href: '/parent/homework' },
      { id: 'parent_view_timetable', text: 'View Timetable', href: '/parent/timetable' },
      { id: 'parent_view_fees', text: 'Check Fee Status', href: '/parent/fees' },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Librarian Steps
// ─────────────────────────────────────────────────────────────────────────────

const librarianSteps: SetupStepCategory[] = [
  {
    title: 'Getting Started',
    icon: BookOpen,
    steps: [
      { id: 'librarian_view_books', text: 'Browse Book Catalog', href: '/librarian/books' },
      { id: 'librarian_categories', text: 'Setup Document Categories', href: '/librarian/library/categories' },
    ],
  },
  {
    title: 'Library Operations',
    icon: Sliders,
    steps: [
      { id: 'librarian_issue_book', text: 'Issue a Book', href: '/librarian/loans' },
      { id: 'librarian_doc_fields', text: 'Configure Document Fields', href: '/librarian/library/document-fields' },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Lookup by role
// ─────────────────────────────────────────────────────────────────────────────

export function getSetupSteps(role: string): SetupStepCategory[] {
  switch (role) {
    case 'admin':
      return adminSteps
    case 'teacher':
      return teacherSteps
    case 'student':
      return studentSteps
    case 'parent':
      return parentSteps
    case 'librarian':
      return librarianSteps
    default:
      return []
  }
}

/** Get all step IDs for a role (flat) */
export function getAllStepIds(role: string): string[] {
  return getSetupSteps(role).flatMap((cat) => cat.steps.map((s) => s.id))
}
