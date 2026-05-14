/**
 * Tour Assistant Steps Configuration
 *
 * Defines the guided tour steps shown to each role.
 * Each step has a title, route, description, and category for the popup.
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
  Megaphone,
  LayoutDashboard,
  DollarSign,
  Star,
  AlertCircle,
  FolderOpen,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TourStep {
  /** Unique stable identifier */
  id: string
  /** Display title for this stop */
  title: string
  /** Route to navigate to */
  href: string
  /** Friendly description shown in the popup */
  description: string
  /** Parent module / category name */
  category: string
  /** Icon for the category */
  categoryIcon: LucideIcon
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Tour Steps
// ─────────────────────────────────────────────────────────────────────────────

const adminTourSteps: TourStep[] = [
  // Dashboard
  {
    id: 'admin_dashboard',
    title: 'Dashboard',
    href: '/admin/dashboard',
    description: 'Your command center — see a live overview of students, attendance, fees, and key school metrics at a glance.',
    category: 'Dashboard',
    categoryIcon: LayoutDashboard,
  },
  // School module
  {
    id: 'admin_school_details',
    title: 'School Details',
    href: '/admin/school-details',
    description: 'Configure your school\'s name, address, logo, phone, and other essential contact information that appears on reports and letters.',
    category: 'School',
    categoryIcon: Building2,
  },
  {
    id: 'admin_marking_periods',
    title: 'Marking Periods',
    href: '/admin/marking-periods',
    description: 'Define semesters, quarters, and full-year periods that control when grades are recorded and report cards are generated.',
    category: 'School',
    categoryIcon: Building2,
  },
  {
    id: 'admin_calendar',
    title: 'Calendar Events',
    href: '/admin/events',
    description: 'Add school holidays, exam days, parent meetings, and other important events to the shared school calendar.',
    category: 'School',
    categoryIcon: Calendar,
  },
  {
    id: 'admin_periods',
    title: 'Periods',
    href: '/admin/periods',
    description: 'Set up your daily class time slots (Period 1, Period 2, etc.) with start and end times used for scheduling.',
    category: 'School',
    categoryIcon: Clock,
  },
  {
    id: 'admin_grade_levels',
    title: 'Grade Levels',
    href: '/admin/academics/grades',
    description: 'Configure the grade levels offered at your school (e.g. Grade 1 through Grade 12) to organize student enrollment.',
    category: 'School',
    categoryIcon: GraduationCap,
  },
  {
    id: 'admin_sections',
    title: 'Sections',
    href: '/admin/academics/sections',
    description: 'Create class sections within each grade level to group students into homerooms or class groups.',
    category: 'School',
    categoryIcon: Users,
  },
  {
    id: 'admin_subjects',
    title: 'Subjects',
    href: '/admin/academics/subjects',
    description: 'Define all subjects taught at your school (Math, Science, English, etc.) that are linked to courses and teachers.',
    category: 'School',
    categoryIcon: BookOpen,
  },
  // Scheduling
  {
    id: 'admin_courses',
    title: 'Courses',
    href: '/admin/scheduling/courses',
    description: 'Create the academic courses offered this year. Courses are linked to subjects and assigned to teachers for scheduling.',
    category: 'Scheduling',
    categoryIcon: Layers,
  },
  {
    id: 'admin_student_schedule',
    title: 'Student Schedules',
    href: '/admin/scheduling/student-schedule',
    description: 'Enroll students into courses and manage their individual academic timetables for the current year.',
    category: 'Scheduling',
    categoryIcon: CalendarCheck,
  },
  {
    id: 'admin_timetable',
    title: 'Timetable',
    href: '/admin/timetable',
    description: 'Set up the master school timetable by mapping courses, teachers, rooms, and periods into a visual weekly schedule.',
    category: 'Scheduling',
    categoryIcon: Clock,
  },
  // Students
  {
    id: 'admin_add_student',
    title: 'Add a Student',
    href: '/admin/students/add-student',
    description: 'Register a new student in the system with their personal info, enrollment details, and section assignment.',
    category: 'Students',
    categoryIcon: GraduationCap,
  },
  {
    id: 'admin_import_students',
    title: 'Import Students',
    href: '/admin/students/bulk-import',
    description: 'Upload a CSV file to enroll hundreds of students at once, saving time during the start of the academic year.',
    category: 'Students',
    categoryIcon: Upload,
  },
  {
    id: 'admin_student_fields',
    title: 'Student Custom Fields',
    href: '/admin/students/custom-fields',
    description: 'Add extra fields to student profiles (blood type, medical info, nationality, etc.) tailored to your school\'s needs.',
    category: 'Students',
    categoryIcon: Settings,
  },
  // Teachers
  {
    id: 'admin_add_teacher',
    title: 'Add a Teacher',
    href: '/admin/teachers/add',
    description: 'Register a teacher with their qualifications, contact details, and subject assignments so they can log in and teach.',
    category: 'Teachers',
    categoryIcon: Users,
  },
  // Staff
  {
    id: 'admin_add_staff',
    title: 'Add Staff',
    href: '/admin/staff/add-staff',
    description: 'Onboard non-teaching staff such as administrators, counselors, or support personnel into the system.',
    category: 'Staff',
    categoryIcon: Users,
  },
  {
    id: 'admin_staff_fields',
    title: 'Staff Custom Fields',
    href: '/admin/staff/custom-fields',
    description: 'Create additional data fields on staff profiles to capture information specific to your institution.',
    category: 'Staff',
    categoryIcon: Settings,
  },
  // Parents
  {
    id: 'admin_add_parent',
    title: 'Add a Parent',
    href: '/admin/parents/add-parent',
    description: 'Register a parent or guardian with their contact details so they can receive communications and monitor their child.',
    category: 'Parents',
    categoryIcon: UserCheck,
  },
  {
    id: 'admin_associate_parent',
    title: 'Associate Parent with Student',
    href: '/admin/parents/associate-parent',
    description: 'Link parents to their child\'s profile so they can access grades, attendance, and school communications.',
    category: 'Parents',
    categoryIcon: UserCheck,
  },
  // Grades
  {
    id: 'admin_grading_scales',
    title: 'Grading Scales',
    href: '/admin/grades/grading-scales',
    description: 'Define your school\'s letter-grade scales (A, B, C…) and their percentage ranges and GPA point equivalents.',
    category: 'Grades',
    categoryIcon: Award,
  },
  {
    id: 'admin_comment_codes',
    title: 'Comment Codes',
    href: '/admin/grades/comment-codes',
    description: 'Create short code-based comments (e.g. "EF" = Excellent Focus) that teachers quickly attach to report cards.',
    category: 'Grades',
    categoryIcon: MessageSquare,
  },
  {
    id: 'admin_report_comments',
    title: 'Report Card Comments',
    href: '/admin/grades/report-card-comments',
    description: 'Build a library of pre-written full-sentence comments teachers can pick from when writing student report cards.',
    category: 'Grades',
    categoryIcon: FileText,
  },
  {
    id: 'admin_grade_config',
    title: 'Grade Configuration',
    href: '/admin/grades/configuration',
    description: 'Configure grading rules: weighted averages, passing marks, rounding policies, and how grades are calculated.',
    category: 'Grades',
    categoryIcon: Sliders,
  },
  // Attendance
  {
    id: 'admin_attendance_codes',
    title: 'Attendance Codes',
    href: '/admin/attendance/codes',
    description: 'Define the attendance statuses used at your school (Present, Absent, Late, Excused) with their visual labels.',
    category: 'Attendance',
    categoryIcon: CalendarCheck,
  },
  // Student Billing
  {
    id: 'admin_fee_categories',
    title: 'Fee Categories',
    href: '/admin/fees/fee-categories',
    description: 'Create billing categories like Tuition, Lab Fee, or Transport so fee types are organized and traceable.',
    category: 'Student Billing',
    categoryIcon: CreditCard,
  },
  {
    id: 'admin_fee_structures',
    title: 'Fee Structures',
    href: '/admin/fees/structures',
    description: 'Set the fee amounts for each category and define which student groups or grade levels each structure applies to.',
    category: 'Student Billing',
    categoryIcon: DollarSign,
  },
  {
    id: 'admin_generate_fees',
    title: 'Generate Fees',
    href: '/admin/fees/generate',
    description: 'Automatically generate fee bills for all enrolled students based on the fee structures defined for this period.',
    category: 'Student Billing',
    categoryIcon: FileText,
  },
  // Settings
  {
    id: 'admin_campuses',
    title: 'Configure Campuses',
    href: '/admin/settings/campuses',
    description: 'Set up and manage multiple physical campuses under your school network, each with its own settings.',
    category: 'Settings',
    categoryIcon: Settings,
  },
  {
    id: 'admin_plugins',
    title: 'Activate Plugins',
    href: '/admin/settings/plugins',
    description: 'Browse and activate optional modules (Hostel, Entry & Exit, Salary, etc.) to extend the system\'s functionality.',
    category: 'Settings',
    categoryIcon: Settings,
  },
  {
    id: 'admin_email_smtp',
    title: 'Configure Email SMTP',
    href: '/admin/settings/email-smtp',
    description: 'Enter your email server credentials so the system can send automated emails for grades, fees, and notifications.',
    category: 'Settings',
    categoryIcon: Settings,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Teacher Tour Steps
// ─────────────────────────────────────────────────────────────────────────────

const teacherTourSteps: TourStep[] = [
  {
    id: 'teacher_dashboard',
    title: 'Dashboard',
    href: '/teacher/dashboard',
    description: 'Your personal teaching hub — view your daily schedule, recent announcements, and a summary of your classes.',
    category: 'Dashboard',
    categoryIcon: LayoutDashboard,
  },
  {
    id: 'teacher_view_portal',
    title: 'Portal Announcements',
    href: '/teacher/portal/notes',
    description: 'Read the latest school announcements, circulars, and communications from your school administration.',
    category: 'Portal',
    categoryIcon: Megaphone,
  },
  {
    id: 'teacher_view_timetable',
    title: 'My Timetable',
    href: '/teacher/timetable',
    description: 'View your personalized weekly timetable showing which classes you teach, when, and in which room.',
    category: 'Academic Management',
    categoryIcon: Clock,
  },
  {
    id: 'teacher_subjects',
    title: 'My Subjects',
    href: '/teacher/subjects',
    description: 'Browse all subjects you are assigned to teach this academic year across your different class sections.',
    category: 'Academic Management',
    categoryIcon: BookOpen,
  },
  {
    id: 'teacher_take_attendance',
    title: 'Take Attendance',
    href: '/teacher/attendance/take-attendance',
    description: 'Record student attendance for each of your classes — mark students as Present, Absent, or Late quickly.',
    category: 'Attendance',
    categoryIcon: CalendarCheck,
  },
  {
    id: 'teacher_attendance_chart',
    title: 'Attendance Chart',
    href: '/teacher/attendance/daily-summary',
    description: 'View a visual summary and chart of attendance patterns across your classes and individual students.',
    category: 'Attendance',
    categoryIcon: BarChart3,
  },
  {
    id: 'teacher_students',
    title: 'Student Info',
    href: '/teacher/students',
    description: 'Browse the profiles of all students in your classes — view their personal details, contact info, and academic history.',
    category: 'Students',
    categoryIcon: GraduationCap,
  },
  {
    id: 'teacher_gradebook',
    title: 'Gradebook',
    href: '/teacher/grades/gradebook',
    description: 'Enter and manage assignment grades, quiz scores, and term marks for students in your gradebook.',
    category: 'Grades',
    categoryIcon: Award,
  },
  {
    id: 'teacher_create_assignment',
    title: 'Assignments',
    href: '/teacher/assignments',
    description: 'Create assignments, set due dates, track submissions, and grade student work all in one place.',
    category: 'Student Learning',
    categoryIcon: ClipboardList,
  },
  {
    id: 'teacher_report_cards',
    title: 'Report Cards',
    href: '/teacher/grades/report-cards',
    description: 'View and print report cards for your students showing their term grades, attendance, and teacher comments.',
    category: 'Grades',
    categoryIcon: FileText,
  },
  {
    id: 'teacher_input_final_grades',
    title: 'Input Final Grades',
    href: '/teacher/grades/input-final-grades',
    description: 'Enter end-of-term final grades for your students across all subjects you teach.',
    category: 'Grades',
    categoryIcon: Award,
  },
  {
    id: 'teacher_lesson_plan',
    title: 'Lesson Plans',
    href: '/teacher/lesson-plans',
    description: 'Create structured lesson plans for your classes — outline learning objectives, activities, and required materials.',
    category: 'Academic Management',
    categoryIcon: BookOpen,
  },
  {
    id: 'teacher_diary_write',
    title: 'Class Diary',
    href: '/teacher/class-diary',
    description: 'Write daily class diary entries recording what was covered in each lesson for administrative and parent review.',
    category: 'Academic Management',
    categoryIcon: FileText,
  },
  {
    id: 'teacher_upload_resource',
    title: 'Learning Resources',
    href: '/teacher/learning-resources',
    description: 'Upload and share study materials, PDFs, presentations, and videos with your students.',
    category: 'Resources',
    categoryIcon: Upload,
  },
  {
    id: 'teacher_scheduling',
    title: 'Class Schedule',
    href: '/teacher/scheduling/schedule',
    description: 'View the full class schedule showing all course periods assigned to you across sections and days.',
    category: 'Scheduling',
    categoryIcon: CalendarCheck,
  },
  {
    id: 'teacher_discipline_referral',
    title: 'Add Disciplinary Referral',
    href: '/teacher/discipline/add-referral',
    description: 'Submit a formal disciplinary referral for a student incident to notify the administration and keep it on record.',
    category: 'Discipline',
    categoryIcon: AlertCircle,
  },
  {
    id: 'teacher_accounting',
    title: 'My Salary',
    href: '/teacher/accounting/salaries',
    description: 'View your salary statements, payroll details, and payment history for the current academic year.',
    category: 'Accounting',
    categoryIcon: DollarSign,
  },
  {
    id: 'teacher_settings',
    title: 'Settings',
    href: '/teacher/settings',
    description: 'Update your personal preferences, notification settings, and account information.',
    category: 'Settings',
    categoryIcon: Settings,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Student Tour Steps
// ─────────────────────────────────────────────────────────────────────────────

const studentTourSteps: TourStep[] = [
  {
    id: 'student_dashboard',
    title: 'Dashboard',
    href: '/student/dashboard',
    description: 'Your personal student hub — see your upcoming assignments, recent grades, attendance summary, and announcements.',
    category: 'Dashboard',
    categoryIcon: LayoutDashboard,
  },
  {
    id: 'student_view_portal',
    title: 'Portal Announcements',
    href: '/student/portal/notes',
    description: 'Stay up to date with the latest school news, events, and announcements from teachers and administration.',
    category: 'Portal',
    categoryIcon: Megaphone,
  },
  {
    id: 'student_view_profile',
    title: 'My Profile',
    href: '/student/profile',
    description: 'Review and update your personal profile, contact information, and account settings.',
    category: 'Getting Started',
    categoryIcon: Eye,
  },
  {
    id: 'student_view_timetable',
    title: 'My Timetable',
    href: '/student/timetable',
    description: 'View your weekly class timetable showing all your subjects, teachers, room numbers, and class periods.',
    category: 'My Classes',
    categoryIcon: Clock,
  },
  {
    id: 'student_view_attendance',
    title: 'Attendance Record',
    href: '/student/attendance',
    description: 'Check your personal attendance history — see which classes you attended, missed, or were late to.',
    category: 'My Classes',
    categoryIcon: CalendarCheck,
  },
  {
    id: 'student_view_assignments',
    title: 'My Assignments',
    href: '/student/assignments',
    description: 'View all your upcoming and past assignments with due dates, submission status, and teacher feedback.',
    category: 'Work & Grades',
    categoryIcon: ClipboardList,
  },
  {
    id: 'student_view_report_cards',
    title: 'Report Cards',
    href: '/student/grades/report-cards',
    description: 'View your official report cards showing your grades per subject, attendance, and teacher comments for each term.',
    category: 'Work & Grades',
    categoryIcon: FileText,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Parent Tour Steps
// ─────────────────────────────────────────────────────────────────────────────

const parentTourSteps: TourStep[] = [
  {
    id: 'parent_dashboard',
    title: 'Dashboard',
    href: '/parent/dashboard',
    description: 'Your parent portal overview — see a summary of your child\'s grades, attendance, upcoming assignments, and announcements.',
    category: 'Dashboard',
    categoryIcon: LayoutDashboard,
  },
  {
    id: 'parent_view_portal',
    title: 'School Announcements',
    href: '/parent/portal/notes',
    description: 'Read the latest official announcements and communications from your school\'s administration.',
    category: 'Getting Started',
    categoryIcon: Megaphone,
  },
  {
    id: 'parent_view_academics',
    title: 'Child\'s Academics',
    href: '/parent/academics',
    description: 'View a full academic overview of your child including enrolled courses, teachers, and academic progress.',
    category: 'Getting Started',
    categoryIcon: GraduationCap,
  },
  {
    id: 'parent_view_attendance',
    title: 'Attendance',
    href: '/parent/attendance',
    description: 'Monitor your child\'s daily attendance record — see which days they were present, absent, or late.',
    category: 'Monitor Your Child',
    categoryIcon: CalendarCheck,
  },
  {
    id: 'parent_view_homework',
    title: 'Homework',
    href: '/parent/homework',
    description: 'Stay on top of your child\'s homework and assignments — track what\'s due, what\'s submitted, and grades received.',
    category: 'Monitor Your Child',
    categoryIcon: ClipboardList,
  },
  {
    id: 'parent_view_timetable',
    title: 'Class Timetable',
    href: '/parent/timetable',
    description: 'View your child\'s weekly class timetable including subjects, teachers, and class periods.',
    category: 'Monitor Your Child',
    categoryIcon: Clock,
  },
  {
    id: 'parent_view_fees',
    title: 'Fee Status',
    href: '/parent/fees',
    description: 'Check outstanding fees, payment history, and due dates for your child\'s school billing.',
    category: 'Monitor Your Child',
    categoryIcon: CreditCard,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Librarian Tour Steps
// ─────────────────────────────────────────────────────────────────────────────

const librarianTourSteps: TourStep[] = [
  {
    id: 'librarian_dashboard',
    title: 'Dashboard',
    href: '/librarian/dashboard',
    description: 'Your library management hub — see overdue books, active loans, recent additions, and library activity at a glance.',
    category: 'Dashboard',
    categoryIcon: LayoutDashboard,
  },
  {
    id: 'librarian_view_books',
    title: 'Book Catalog',
    href: '/librarian/books',
    description: 'Browse and manage the entire library catalog — search books by title, author, ISBN, or category.',
    category: 'Getting Started',
    categoryIcon: BookOpen,
  },
  {
    id: 'librarian_categories',
    title: 'Document Categories',
    href: '/librarian/library/categories',
    description: 'Set up document categories (Fiction, Science, Reference, etc.) to organize library materials systematically.',
    category: 'Getting Started',
    categoryIcon: FolderOpen,
  },
  {
    id: 'librarian_issue_book',
    title: 'Issue a Book',
    href: '/librarian/loans',
    description: 'Check out books to students or staff — record who borrowed what, when, and the expected return date.',
    category: 'Library Operations',
    categoryIcon: BookOpen,
  },
  {
    id: 'librarian_doc_fields',
    title: 'Document Fields',
    href: '/librarian/library/document-fields',
    description: 'Configure custom metadata fields for library documents such as ISBN, publisher, edition, and condition.',
    category: 'Library Operations',
    categoryIcon: Sliders,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Lookup by role
// ─────────────────────────────────────────────────────────────────────────────

export function getTourSteps(role: string): TourStep[] {
  switch (role) {
    case 'admin':
      return adminTourSteps
    case 'teacher':
      return teacherTourSteps
    case 'student':
      return studentTourSteps
    case 'parent':
      return parentTourSteps
    case 'librarian':
      return librarianTourSteps
    default:
      return []
  }
}
