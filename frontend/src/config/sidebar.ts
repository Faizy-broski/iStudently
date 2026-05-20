import {
  LayoutDashboard,
  Users,
  GraduationCap,
  DoorOpen,
  UserCheck,
  BookOpen,
  CalendarCheck,
  FileText,
  ClipboardList,
  Clock,
  Library,
  Calendar,
  BarChart3,
  Settings,
  Building2,
  CreditCard,
  School,
  DollarSign,
  Receipt,
  Plus,
  FolderOpen,
  CheckSquare,
  Award,
  Upload,
  Megaphone,
  Calculator,
  TrendingUp,
  TrendingDown,
  Layers,
  Sliders,
  BedDouble,
  Eye,
  ShoppingBag,
  Package,
  Bell,
  Link2,
  Camera,
  RefreshCw,
  MessageSquare,
  History,
  AlertCircle,
  Star,
  UserPlus,
  ClipboardCheck,
  CalendarPlus,
  ShieldX,
  ShieldPlus,
  CalendarOff,
  HelpCircle,
  Mail,
  Send,
  Puzzle,
  Globe,
  type LucideIcon,
} from "lucide-react";
import { UserRole } from "@/types";

export interface SidebarMenuItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string | number;
  subItems?: SidebarMenuItem[];
  isLabel?: boolean;
}

export interface SidebarConfig {
  role: UserRole;
  menuItems: SidebarMenuItem[];
}

// Super Admin Menu Items
const superAdminMenuItems: SidebarMenuItem[] = [
  { title: "dashboard", href: "/superadmin/dashboard", icon: LayoutDashboard },
  { title: "school_directory", href: "/superadmin/school-directory", icon: Building2 },
  { title: "onboard_school", href: "/superadmin/onboard-school", icon: School },
  { title: "billing_status", href: "/superadmin/billing-status", icon: CreditCard },
  { title: "settings", href: "/superadmin/settings", icon: Settings },
];

// Admin Menu Items (School Admin)
const adminMenuItems: SidebarMenuItem[] = [
  { title: "dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  {
    title: "school",
    href: "/admin/academics",
    icon: School,
    subItems: [
      { title: "school_details", href: "/admin/school-details", icon: Building2 },
      { title: "overview", href: "/admin/academics", icon: LayoutDashboard },
      { title: "grade_levels", href: "/admin/academics/grades", icon: GraduationCap },
      { title: "sections", href: "/admin/academics/sections", icon: Users },
      { title: "subjects", href: "/admin/academics/subjects", icon: BookOpen },
      { title: "periods", href: "/admin/periods", icon: Clock },
      { title: "marking_periods", href: "/admin/marking-periods", icon: Layers },
      { title: "timetable", href: "/admin/timetable", icon: Clock },
      { title: "bulk_import_timetable", href: "/admin/timetable/import", icon: Upload },
      { title: "calendar", href: "/admin/events", icon: Calendar },
      { title: "portal_notes", href: "/admin/portal/notes", icon: FileText },
      { title: "portal_polls", href: "/admin/portal/polls", icon: BarChart3 },
      { title: "utilities", href: "#", icon: Settings, isLabel: true },
      { title: "year_end_rollover", href: "/admin/rollover", icon: RefreshCw },
      { title: "semester_rollover", href: "/admin/rollover/semester", icon: RefreshCw },
      { title: "configuration", href: "#", icon: Settings, isLabel: true },
      { title: "plugins", href: "/admin/settings/plugins", icon: Puzzle },
    ],
  },
  {
    title: "scheduling",
    href: "/admin/scheduling",
    icon: CalendarCheck,
    subItems: [
      { title: "dashboard", href: "/admin/scheduling/dashboard", icon: CalendarCheck },
      { title: "courses", href: "/admin/scheduling/courses", icon: Layers },
      { title: "student_schedule", href: "/admin/scheduling/student-schedule", icon: CalendarCheck },
      { title: "group_schedule", href: "/admin/scheduling/group-schedule", icon: Users },
      { title: "group_requests", href: "/admin/scheduling/group-requests", icon: ClipboardList },
      { title: "group_drops", href: "/admin/scheduling/group-drops", icon: TrendingDown },
      { title: "lesson_plans", href: "#", icon: BookOpen, isLabel: true },
      { title: "lesson_plans", href: "/admin/scheduling/lesson-plans", icon: BookOpen },
      { title: "lesson_plan_read", href: "/admin/scheduling/lesson-plan-read", icon: Eye },
      { title: "reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "print_schedules", href: "/admin/scheduling/print-schedules", icon: FileText },
      { title: "print_class_pictures", href: "/admin/scheduling/print-class-pictures", icon: FileText },
      { title: "schedule_report", href: "/admin/scheduling/schedule-report", icon: FileText },
      { title: "requests_report", href: "/admin/scheduling/requests-report", icon: FileText },
      { title: "incomplete_schedules", href: "/admin/scheduling/incomplete-schedules", icon: FileText },
      { title: "add_drop_report", href: "/admin/scheduling/add-drop-report", icon: FileText },
    ],
  },
  {
    title: "students",
    href: "/admin/students",
    icon: GraduationCap,
    subItems: [
      { title: "student_info", href: "/admin/students/student-info", icon: GraduationCap },
      { title: "add_student", href: "/admin/students/add-student", icon: Users },
      { title: "bulk_import", href: "/admin/students/bulk-import", icon: Upload },
      { title: "custom_fields", href: "/admin/students/custom-fields", icon: Settings },
      { title: "student_id_card", href: "/admin/students/id-card", icon: CreditCard },
      { title: "certificate", href: "/admin/students/certificate-enrollment", icon: Award },
      { title: "reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "print_student_info", href: "/admin/students/print-info", icon: FileText },
      { title: "print_letters", href: "/admin/students/print-letters", icon: FileText },
      { title: "student_breakdown", href: "/admin/students/breakdown", icon: BarChart3 },
      { title: "advanced_report", href: "/admin/students/advanced-report", icon: FileText },
      { title: "email_students", href: "#", icon: Mail, isLabel: true },
      { title: "send_email", href: "/admin/email/students", icon: Mail },
    ],
  },
  {
    title: "email",
    href: "/admin/email/students",
    icon: Mail,
    subItems: [
      { title: "send_to_students", href: "/admin/email/students", icon: Send },
      { title: "send_to_staff", href: "/admin/email/staff", icon: Send },
      { title: "email_log", href: "/admin/email/log", icon: FileText },
      { title: "notifications", href: "#", icon: Bell, isLabel: true },
      { title: "email_notifications", href: "/admin/email/notifications", icon: Bell },
    ],
  },
  {
    title: "activities",
    href: "/admin/activities",
    icon: Star,
    subItems: [
      { title: "student_screen", href: "/admin/activities", icon: Star },
      { title: "add_activity", href: "/admin/activities/add-activity", icon: UserPlus },
      { title: "enter_eligibility", href: "/admin/activities/enter-eligibility", icon: ClipboardCheck },
      { title: "reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "student_list", href: "/admin/activities/reports/student-list", icon: Users },
      { title: "teacher_completion", href: "/admin/activities/reports/teacher-completion", icon: CheckSquare },
      { title: "setup", href: "#", icon: Settings, isLabel: true },
      { title: "activities", href: "/admin/activities/setup/activities", icon: Settings },
      { title: "entry_times", href: "/admin/activities/setup/entry-times", icon: Clock },
    ],
  },
  {
    title: "discipline",
    href: "/admin/discipline",
    icon: AlertCircle,
    subItems: [
      { title: "add_referral", href: "/admin/discipline/add-referral", icon: Plus },
      { title: "referrals", href: "/admin/discipline", icon: ClipboardList },
      { title: "reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "category_breakdown", href: "/admin/discipline/reports/category-breakdown", icon: BarChart3 },
      { title: "breakdown_over_time", href: "/admin/discipline/reports/category-breakdown-time", icon: TrendingUp },
      { title: "breakdown_by_student_field", href: "/admin/discipline/reports/breakdown-student-field", icon: Users },
      { title: "discipline_log", href: "/admin/discipline/reports/log", icon: FileText },
      { title: "setup", href: "#", icon: Settings, isLabel: true },
      { title: "referral_form", href: "/admin/discipline/referral-form", icon: Settings },
    ],
  },
  {
    title: "quiz",
    href: "/admin/quiz",
    icon: HelpCircle,
    subItems: [
      { title: "quizzes", href: "/admin/quiz/quizzes", icon: HelpCircle },
      { title: "questions", href: "/admin/quiz/questions", icon: BookOpen },
      { title: "premium", href: "#", icon: BarChart3, isLabel: true },
      { title: "answer_breakdown", href: "/admin/quiz/answer-breakdown", icon: BarChart3 },
      { title: "configuration", href: "/admin/quiz/configuration", icon: Settings },
    ],
  },
  {
    title: "staff_absences",
    href: "/admin/staff-absences",
    icon: CalendarOff,
    subItems: [
      { title: "add_absence", href: "/admin/staff-absences/add-absence", icon: Plus },
      { title: "absences", href: "/admin/staff-absences/absences", icon: CalendarOff },
      { title: "reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "cancelled_classes", href: "/admin/staff-absences/cancelled-classes", icon: BookOpen },
      { title: "days_absent_breakdown", href: "/admin/staff-absences/breakdown", icon: BarChart3 },
      { title: "setup", href: "#", icon: Settings, isLabel: true },
      { title: "absence_fields", href: "/admin/staff-absences/fields", icon: Settings },
    ],
  },
  {
    title: "teachers",
    href: "/admin/teachers",
    icon: Users,
    subItems: [
      { title: "all_teachers", href: "/admin/teachers", icon: Users },
      { title: "add_teacher", href: "/admin/teachers/add", icon: Plus },
      { title: "workload", href: "/admin/teachers/workload", icon: ClipboardList },
      { title: "custom_fields", href: "/admin/teachers/custom-fields", icon: Settings },
    ],
  },
  {
    title: "staff",
    href: "/admin/staff",
    icon: Users,
    subItems: [
      { title: "all_staff", href: "/admin/staff", icon: Users },
      { title: "add_staff", href: "/admin/staff/add-staff", icon: Plus },
      { title: "bulk_import", href: "/admin/staff/bulk-import", icon: Upload },
      { title: "custom_fields", href: "/admin/staff/custom-fields", icon: Settings },
      { title: "settings", href: "/admin/staff/settings", icon: Settings },
    ],
  },
  {
    title: "parents",
    href: "/admin/parents",
    icon: UserCheck,
    subItems: [
      { title: "parent_info", href: "/admin/parents/parent-info", icon: UserCheck },
      { title: "add_parent", href: "/admin/parents/add-parent", icon: UserCheck },
      { title: "associate_parent", href: "/admin/parents/associate-parent", icon: Users },
      { title: "custom_fields", href: "/admin/parents/custom-fields", icon: Settings },
      { title: "email_parents", href: "#", icon: Mail, isLabel: true },
      { title: "notifications", href: "/admin/email/notifications", icon: Bell },
    ],
  },
  {
    title: "attendance",
    href: "/admin/attendance",
    icon: CalendarCheck,
    subItems: [
      { title: "administration", href: "/admin/attendance/administration", icon: Eye },
      { title: "add_absences", href: "/admin/attendance/add-absences", icon: Plus },
      { title: "reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "teacher_completion", href: "/admin/attendance/teacher-completion", icon: CheckSquare },
      { title: "average_daily_attendance", href: "/admin/attendance/average-daily", icon: BarChart3 },
      { title: "attendance_chart", href: "/admin/attendance/chart", icon: BarChart3 },
      { title: "utilities", href: "#", icon: Settings, isLabel: true },
      { title: "recalculate_daily_attendance", href: "/admin/attendance/recalculate", icon: RefreshCw },
      { title: "delete_duplicate_attendance", href: "/admin/attendance/delete-duplicates", icon: AlertCircle },
      { title: "setup", href: "#", icon: Settings, isLabel: true },
      { title: "attendance_codes", href: "/admin/attendance/codes", icon: Settings },
    ],
  },
  {
    title: "grades",
    href: "/admin/grades",
    icon: Award,
    subItems: [
      { title: "report_cards", href: "/admin/grades/report-cards", icon: FileText },
      { title: "transcripts", href: "/admin/grades/transcripts", icon: GraduationCap },
      { title: "student_grades", href: "/admin/grades/student-grades", icon: GraduationCap },
      { title: "progress_reports", href: "/admin/grades/progress-reports", icon: ClipboardList },
      { title: "teacher_completion", href: "/admin/grades/teacher-completion", icon: CheckSquare },
      { title: "gradebook_breakdown", href: "/admin/grades/gradebook", icon: BarChart3 },
      { title: "final_grades", href: "/admin/grades/final-grades", icon: CheckSquare },
      { title: "mass_create_assignments", href: "/admin/grades/mass-create-assignments", icon: ClipboardList },
      { title: "setup", href: "#", icon: Settings, isLabel: true },
      { title: "configuration", href: "/admin/grades/configuration", icon: Settings },
      { title: "grading_scales", href: "/admin/grades/grading-scales", icon: Sliders },
      { title: "report_card_comments", href: "/admin/grades/report-card-comments", icon: MessageSquare },
      { title: "comment_codes", href: "/admin/grades/comment-codes", icon: MessageSquare },
      { title: "history_marking_periods", href: "/admin/grades/history-marking-periods", icon: History },
      { title: "historical_grades", href: "/admin/grades/historical-grades", icon: FileText },
      { title: "graduation_paths", href: "/admin/grades/graduation-paths", icon: Award },
      { title: "import_grades", href: "/admin/grades/import-grades", icon: Upload },
      { title: "reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "honor_roll", href: "/admin/grades/honor-roll", icon: Award },
      { title: "gpa_class_ranks", href: "/admin/grades/class-ranks", icon: TrendingUp },
      { title: "email_students", href: "#", icon: Mail, isLabel: true },
      { title: "send_report_cards", href: "/admin/grades/email-students", icon: Mail },
      { title: "email_parents", href: "#", icon: Mail, isLabel: true },
      { title: "send_report_cards", href: "/admin/grades/email-parents", icon: Mail },
    ],
  },
  {
    title: "student_billing",
    href: "/admin/fees",
    icon: CreditCard,
    subItems: [
      { title: "dashboard", href: "/admin/fees", icon: LayoutDashboard },
      { title: "payments", href: "/admin/fees/payments", icon: Receipt },
      { title: "generate_fees", href: "/admin/fees/generate", icon: FileText },
      { title: "fee_overrides", href: "/admin/fees/overrides", icon: Sliders },
      { title: "student_balances", href: "/admin/fees/student-balances", icon: Users },
      { title: "fee_structures", href: "/admin/fees/structures", icon: Layers },
      { title: "fee_categories", href: "/admin/fees/fee-categories", icon: FolderOpen },
      { title: "print_invoices", href: "/admin/fees/print-invoices", icon: FileText },
      { title: "print_receipts", href: "/admin/fees/print-receipts", icon: Receipt },
      { title: "daily_transactions", href: "/admin/billing-elements/daily-transactions", icon: Receipt },
      { title: "settings", href: "/admin/fees/settings", icon: Settings },
      { title: "email_students", href: "#", icon: Mail, isLabel: true },
      { title: "send_balances", href: "/admin/fees/email-students", icon: Mail },
      { title: "email_parents", href: "#", icon: Mail, isLabel: true },
      { title: "send_balances", href: "/admin/fees/email-parents", icon: Mail },
    ],
  },
  {
    title: "billing_elements",
    href: "/admin/billing-elements",
    icon: ShoppingBag,
    subItems: [
      { title: "elements", href: "/admin/billing-elements", icon: Package },
      { title: "mass_assign", href: "/admin/billing-elements/mass-assign", icon: Users },
      { title: "student_elements", href: "/admin/billing-elements/student-elements", icon: UserCheck },
      { title: "reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "category_breakdown", href: "/admin/billing-elements/category-breakdown", icon: BarChart3 },
    ],
  },
  {
    title: "salary",
    href: "/admin/salary",
    icon: DollarSign,
    subItems: [
      { title: "dashboard", href: "/admin/salary", icon: LayoutDashboard },
      { title: "generate_salaries", href: "/admin/salary/generate", icon: FileText },
      { title: "advances", href: "/admin/salary/advances", icon: CreditCard },
      { title: "settings", href: "/admin/salary/settings", icon: Settings },
    ],
  },
  {
    title: "accounting",
    href: "/admin/accounting/incomes",
    icon: Calculator,
    subItems: [
      { title: "incomes", href: "/admin/accounting/incomes", icon: TrendingUp },
      { title: "expenses", href: "/admin/accounting/expenses", icon: TrendingDown },
      { title: "staff_payments", href: "/admin/accounting/staff-payments", icon: Receipt },
      { title: "teacher_hours", href: "/admin/accounting/teacher-hours", icon: Clock },
      { title: "payees", href: "/admin/accounting/payees", icon: Users },
      { title: "reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "daily_transactions", href: "/admin/accounting/daily-transactions", icon: FileText },
      { title: "staff_balances", href: "/admin/accounting/staff-balances", icon: Users },
      { title: "setup", href: "#", icon: Settings, isLabel: true },
      { title: "categories", href: "/admin/accounting/categories", icon: Layers },
    ],
  },
  {
    title: "library",
    href: "/admin/library",
    icon: Library,
    subItems: [
      { title: "overview", href: "/admin/library", icon: BookOpen },
      { title: "document_categories", href: "/admin/library/categories", icon: FolderOpen },
      { title: "document_fields", href: "/admin/library/document-fields", icon: Sliders },
      
    ],
  },
  {
    title: "reports",
    href: "/admin/reports/calculations",
    icon: BarChart3,
    subItems: [
      { title: "calculations", href: "/admin/reports/calculations", icon: Calculator },
      { title: "calculation_reports", href: "/admin/reports/calculation-reports", icon: FileText },
    ],
  },
  {
    title: "entry_exit",
    href: "/admin/entry-exit",
    icon: DoorOpen,
    subItems: [
      { title: "dashboard", href: "/admin/entry-exit", icon: LayoutDashboard },
      { title: "add_records", href: "/admin/entry-exit/add-records", icon: UserPlus },
      { title: "records", href: "/admin/entry-exit/report", icon: ClipboardList },
      { title: "checkpoints", href: "/admin/entry-exit/checkpoints", icon: Building2 },
      { title: "evening_leaves", href: "/admin/entry-exit/evening-leaves", icon: Clock },
      { title: "mass_evening_leaves", href: "/admin/entry-exit/mass-evening-leaves", icon: CalendarPlus },
      { title: "packages", href: "/admin/entry-exit/packages", icon: FileText },
      { title: "automatic_records", href: "/admin/entry-exit/automatic-records", icon: ClipboardCheck },
      { title: "exceptions", href: "/admin/entry-exit/exceptions", icon: ShieldX },
      { title: "add_exceptions", href: "/admin/entry-exit/add-exceptions", icon: ShieldPlus },
      { title: "take_attendance", href: "/admin/entry-exit/take-attendance", icon: UserCheck },
    ],
  },
  {
    title: "hostel",
    href: "/admin/hostel",
    icon: BedDouble,
    subItems: [
      { title: "dashboard", href: "/admin/hostel", icon: LayoutDashboard },
      { title: "buildings", href: "/admin/hostel/buildings", icon: Building2 },
      { title: "rooms", href: "/admin/hostel/rooms", icon: DoorOpen },
      { title: "assignments", href: "/admin/hostel/assignments", icon: Users },
      { title: "visits", href: "/admin/hostel/visits", icon: Eye },
      { title: "fees", href: "/admin/hostel/fees", icon: DollarSign },
      { title: "room_fields", href: "/admin/hostel/fields", icon: Settings },
      { title: "configuration", href: "/admin/hostel/settings", icon: Settings },
    ],
  },
  {
    title: "resources",
    href: "/admin/resources/links",
    icon: FolderOpen,
    subItems: [
      { title: "resources", href: "/admin/resources/links", icon: Link2 },
      { title: "dashboards", href: "/admin/resources/dashboards", icon: LayoutDashboard },
      { title: "school_inventory", href: "/admin/resources/school-inventory", icon: Package },
      { title: "inventory_snapshots", href: "/admin/resources/inventory-snapshots", icon: Camera },
    ],
  },
  {
    title: "settings",
    href: "/admin/settings",
    icon: Settings,
    subItems: [
      { title: "general", href: "/admin/settings", icon: Settings },
      { title: "campuses", href: "/admin/settings/campuses", icon: Building2 },
      { title: "academic_years", href: "/admin/settings/academic-years", icon: Calendar },
      { title: "services", href: "/admin/settings/services", icon: Settings },
      { title: "email_reminders", href: "/admin/settings/email-reminders", icon: Bell },
      { title: "email_smtp", href: "/admin/settings/email-smtp", icon: Mail },
      { title: "public_pages", href: "/admin/settings/public-pages", icon: Globe },
    ],
  },
];

// Teacher Menu Items
const teacherMenuItems: SidebarMenuItem[] = [
  { title: "dashboard", href: "/teacher/dashboard", icon: LayoutDashboard },
  {
    title: "school",
    href: "/teacher/school-information",
    icon: School,
    subItems: [
      { title: "school_information", href: "/teacher/school-information", icon: Building2 },
      { title: "calendar", href: "/teacher/events", icon: Calendar },
      { title: "marking_periods", href: "/teacher/marking-periods", icon: Layers },
      { title: "periods", href: "/teacher/periods", icon: Clock },
    ],
  },
  {
    title: "students",
    href: "/teacher/students",
    icon: GraduationCap,
    subItems: [
      { title: "student_info", href: "/teacher/students", icon: GraduationCap },
      { title: "associated_parents", href: "/teacher/students/associated-parents", icon: UserCheck },
      { title: "reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "advanced_report", href: "/teacher/students/advanced-report", icon: FileText },
      { title: "print_student_labels", href: "/teacher/students/student-labels", icon: FileText },
      { title: "print_letters", href: "/teacher/students/print-letters", icon: FileText },
    ],
  },
  {
    title: "scheduling",
    href: "/teacher/scheduling/schedule",
    icon: CalendarCheck,
    subItems: [
      { title: "schedule", href: "/teacher/scheduling/schedule", icon: CalendarCheck },
      { title: "courses", href: "/teacher/scheduling/courses", icon: Layers },
      { title: "reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "print_schedules", href: "/teacher/scheduling/print-schedules", icon: FileText },
      { title: "print_class_pictures", href: "/teacher/scheduling/print-class-pictures", icon: Camera },
    ],
  },
  {
    title: "grades",
    href: "/teacher/grades",
    icon: Award,
    subItems: [
      { title: "input_final_grades", href: "/teacher/grades/input-final-grades", icon: CheckSquare },
      { title: "report_cards", href: "/teacher/grades/report-cards", icon: FileText },
      { title: "gradebook", href: "#", icon: BookOpen, isLabel: true },
      { title: "gradebook", href: "/teacher/grades/gradebook", icon: Award },
      { title: "assignments", href: "/teacher/grades/assignments", icon: ClipboardList },
      { title: "anomalous_grades", href: "/teacher/grades/anomalous-grades", icon: AlertCircle },
      { title: "progress_reports", href: "/teacher/grades/progress-reports", icon: ClipboardList },
      { title: "grade_breakdown", href: "/teacher/grades/gradebook-breakdown", icon: BarChart3 },
      { title: "reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "student_grades", href: "/teacher/grades/student-grades", icon: GraduationCap },
      { title: "final_grades", href: "/teacher/grades/final-grades", icon: CheckSquare },
      { title: "gpa_class_rank_list", href: "/teacher/grades/gpa-rank-list", icon: TrendingUp },
      { title: "setup", href: "#", icon: Settings, isLabel: true },
      { title: "configuration", href: "/teacher/grades/configuration", icon: Settings },
      { title: "grading_scales", href: "/teacher/grades/grading-scales", icon: Sliders },
      { title: "report_card_comments", href: "/teacher/grades/report-card-comments", icon: MessageSquare },
      { title: "comment_codes", href: "/teacher/grades/comment-codes", icon: MessageSquare },
    ],
  },
  {
    title: "attendance",
    href: "/teacher/attendance",
    icon: CalendarCheck,
    subItems: [
      { title: "take_attendance", href: "/teacher/attendance/take-attendance", icon: UserCheck },
      { title: "attendance_chart", href: "/teacher/attendance/daily-summary", icon: BarChart3 },
    ],
  },
  {
    title: "activities",
    href: "/teacher/activities",
    icon: Star,
    subItems: [
      { title: "enter_eligibility", href: "/teacher/activities/eligibility", icon: Star },
    ],
  },
  {
    title: "discipline",
    href: "/teacher/discipline",
    icon: AlertCircle,
    subItems: [
      { title: "add_referral", href: "/teacher/discipline/add-referral", icon: Plus },
      { title: "referrals", href: "/teacher/discipline/referrals", icon: ClipboardList },
    ],
  },
  {
    title: "accounting",
    href: "/teacher/accounting",
    icon: DollarSign,
    subItems: [
      { title: "staff_payroll", href: "#", icon: DollarSign, isLabel: true },
      { title: "salaries", href: "/teacher/accounting/salaries", icon: DollarSign },
      { title: "staff_payments", href: "/teacher/accounting/staff-payments", icon: DollarSign },
      { title: "reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "print_statements", href: "/teacher/accounting/print-statements", icon: FileText },
    ],
  },
  {
    title: "resources",
    href: "/teacher/learning-resources",
    icon: FolderOpen,
    subItems: [
      { title: "resources", href: "/teacher/resources", icon: Link2 },
      { title: "learning_resources", href: "/teacher/learning-resources", icon: Upload },
      { title: "class_reports", href: "/teacher/reports", icon: BarChart3 },
    ],
  },
  {
    title: "portal",
    href: "/teacher/portal/notes",
    icon: Megaphone,
    subItems: [
      { title: "announcements", href: "/teacher/portal/notes", icon: FileText },
      { title: "polls", href: "/teacher/portal/polls", icon: BarChart3 },
    ],
  },
  {
    title: "academic_management",
    href: "/teacher/timetable",
    icon: Clock,
    subItems: [
      { title: "my_timetable", href: "/teacher/timetable", icon: Clock },
      { title: "subjects", href: "/teacher/subjects", icon: BookOpen },
      { title: "class_diary", href: "/teacher/class-diary", icon: ClipboardList },
      { title: "lesson_plan_add", href: "/teacher/lesson-plans", icon: BookOpen },
      { title: "lesson_plan_read", href: "/teacher/lesson-plan-read", icon: Eye },
    ],
  },
  {
    title: "student_learning",
    href: "/teacher/assignments",
    icon: ClipboardList,
    subItems: [
      { title: "assignments", href: "/teacher/assignments", icon: ClipboardList },
      { title: "submissions", href: "/teacher/submissions", icon: CheckSquare },
      { title: "exams_grading", href: "/teacher/exams", icon: Award },
      { title: "quizzes", href: "/teacher/quiz", icon: HelpCircle },
    ],
  },
  { title: "settings", href: "/teacher/settings", icon: Settings },
];

// Student Menu Items
const studentMenuItems: SidebarMenuItem[] = [
  { title: "dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  {
    title: "school",
    href: "/student/school-information",
    icon: School,
    subItems: [
      { title: "school_information", href: "/student/school-information", icon: Building2 },
      { title: "calendar", href: "/student/events", icon: Calendar },
      { title: "marking_periods", href: "/student/marking-periods", icon: Layers },
    ],
  },
  {
    title: "portal",
    href: "/student/portal/notes",
    icon: Megaphone,
    subItems: [
      { title: "announcements", href: "/student/portal/notes", icon: FileText },
      { title: "polls", href: "/student/portal/polls", icon: BarChart3 },
    ],
  },
  { title: "students", href: "/student/students", icon: UserCheck },
  {
    title: "scheduling",
    href: "/student/scheduling/schedule",
    icon: CalendarCheck,
    subItems: [
      { title: "schedule", href: "/student/scheduling/schedule", icon: CalendarCheck },
      { title: "student_requests", href: "/student/scheduling/student-requests", icon: ClipboardList },
      { title: "courses", href: "/student/scheduling/courses", icon: BookOpen },
      { title: "lesson_plans", href: "#", icon: BookOpen, isLabel: true },
      { title: "lesson_plan_read", href: "/student/scheduling/lesson-plan-read", icon: Eye },
      { title: "reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "print_schedules", href: "/student/scheduling/print-schedules", icon: FileText },
      { title: "class_pictures", href: "/student/scheduling/print-class-pictures", icon: Camera },
    ],
  },
  {
    title: "grades",
    href: "/student/grades/student-grades",
    icon: Award,
    subItems: [
      { title: "gradebook_grades", href: "/student/grades/student-grades", icon: Award },
      { title: "assignments", href: "/student/assignments", icon: ClipboardList },
      { title: "final_grades", href: "/student/grades/final-grades", icon: CheckSquare },
      { title: "report_cards", href: "/student/grades/report-cards", icon: FileText },
      { title: "progress_reports", href: "/student/grades/progress-reports", icon: ClipboardList },
      { title: "transcripts", href: "/student/grades/transcripts", icon: GraduationCap },
      { title: "gpa_class_rank_list", href: "/student/grades/gpa-rank-list", icon: TrendingUp },
    ],
  },
  {
    title: "attendance",
    href: "/student/attendance",
    icon: CalendarCheck,
    subItems: [
      { title: "daily_summary", href: "/student/attendance", icon: CalendarCheck },
    ],
  },
  {
    title: "student_billing",
    href: "/student/billing/fees",
    icon: Receipt,
    subItems: [
      { title: "fees", href: "/student/billing/fees", icon: Receipt },
      { title: "payments", href: "/student/billing/payments", icon: CreditCard },
      { title: "reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "daily_transactions", href: "/student/billing/daily-transactions", icon: DollarSign },
      { title: "print_statements", href: "/student/billing/print-statements", icon: FileText },
    ],
  },
  {
    title: "discipline",
    href: "/student/discipline",
    icon: AlertCircle,
    subItems: [
      { title: "referrals", href: "/student/discipline", icon: ClipboardList },
    ],
  },
  { title: "activities", href: "/student/activities", icon: Star },
  {
    title: "library",
    href: "/student/library",
    icon: Library,
    subItems: [
      { title: "my_loans", href: "/student/library", icon: BookOpen },
      { title: "e_library", href: "/student/e-library", icon: BookOpen },
    ],
  },
  { title: "hostel", href: "/student/hostel", icon: BedDouble },
  {
    title: "resources",
    href: "/student/learning-resources",
    icon: FolderOpen,
    subItems: [
      { title: "resources", href: "/student/resources", icon: Link2 },
      { title: "learning_resources", href: "/student/learning-resources", icon: Upload },
      { title: "syllabus", href: "/student/syllabus", icon: BookOpen },
      { title: "learning_materials", href: "/student/materials", icon: Library },
    ],
  },
  {
    title: "profile",
    href: "/student/profile",
    icon: UserCheck,
    subItems: [
      { title: "id_card", href: "/student/id-card", icon: CreditCard },
      { title: "my_profile", href: "/student/profile", icon: UserCheck },
    ],
  },
];

// Parent Menu Items
const parentMenuItems: SidebarMenuItem[] = [
  { title: "dashboard", href: "/parent/dashboard", icon: LayoutDashboard },
  {
    title: "school",
    href: "/parent/school-information",
    icon: School,
    subItems: [
      { title: "school_information", href: "/parent/school-information", icon: Building2 },
      { title: "calendar", href: "/parent/events", icon: Calendar },
      { title: "marking_periods", href: "/parent/marking-periods", icon: Layers },
    ],
  },
  {
    title: "portal",
    href: "/parent/portal/notes",
    icon: Megaphone,
    subItems: [
      { title: "announcements", href: "/parent/portal/notes", icon: FileText },
      { title: "polls", href: "/parent/portal/polls", icon: BarChart3 },
    ],
  },
  { title: "students", href: "/parent/students", icon: GraduationCap },
  {
    title: "scheduling",
    href: "/parent/scheduling/schedule",
    icon: CalendarCheck,
    subItems: [
      { title: "schedule", href: "/parent/scheduling/schedule", icon: CalendarCheck },
      { title: "student_requests", href: "/parent/scheduling/student-requests", icon: ClipboardList },
      { title: "courses", href: "/parent/scheduling/courses", icon: Layers },
      { title: "lesson_plans", href: "#", icon: BookOpen, isLabel: true },
      { title: "lesson_plan_read", href: "/parent/scheduling/lesson-plan-read", icon: Eye },
      { title: "reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "print_schedules", href: "/parent/scheduling/print-schedules", icon: FileText },
      { title: "class_pictures", href: "/parent/scheduling/print-class-pictures", icon: Camera },
    ],
  },
  {
    title: "grades",
    href: "/parent/grades/student-grades",
    icon: Award,
    subItems: [
      { title: "gradebook_grades", href: "/parent/grades/student-grades", icon: Award },
      { title: "assignments", href: "/parent/grades/student-assignments", icon: ClipboardList },
      { title: "final_grades", href: "/parent/grades/final-grades", icon: CheckSquare },
      { title: "report_cards", href: "/parent/grades/report-cards", icon: FileText },
      { title: "progress_reports", href: "/parent/grades/progress-reports", icon: ClipboardList },
      { title: "transcripts", href: "/parent/grades/transcripts", icon: GraduationCap },
      { title: "gpa_class_rank_list", href: "/parent/grades/gpa-rank-list", icon: TrendingUp },
    ],
  },
  {
    title: "attendance",
    href: "/parent/attendance",
    icon: CalendarCheck,
    subItems: [
      { title: "daily_summary", href: "/parent/attendance", icon: CalendarCheck },
    ],
  },
  {
    title: "student_billing",
    href: "/parent/billing/fees",
    icon: Receipt,
    subItems: [
      { title: "fees", href: "/parent/billing/fees", icon: Receipt },
      { title: "payments", href: "/parent/billing/payments", icon: CreditCard },
      { title: "reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "daily_transactions", href: "/parent/billing/daily-transactions", icon: DollarSign },
      { title: "print_statements", href: "/parent/billing/print-statements", icon: FileText },
    ],
  },
  { title: "class_diary", href: "/parent/class-diary", icon: BookOpen },
  { title: "timetable", href: "/parent/timetable", icon: Clock },
  {
    title: "discipline",
    href: "/parent/discipline",
    icon: AlertCircle,
    subItems: [
      { title: "referrals", href: "/parent/discipline", icon: ClipboardList },
    ],
  },
  { title: "activities", href: "/parent/activities", icon: Star },
  { title: "id_card", href: "/parent/id-card", icon: CreditCard },
  {
    title: "resources",
    href: "/parent/resources",
    icon: FolderOpen,
    subItems: [
      { title: "resources", href: "/parent/resources", icon: Link2 },
    ],
  },
  { title: "settings", href: "/parent/settings", icon: Settings },
];

// Librarian Menu Items
const librarianMenuItems: SidebarMenuItem[] = [
  { title: "dashboard", href: "/librarian/dashboard", icon: LayoutDashboard },
  { title: "books", href: "/librarian/books", icon: BookOpen },
  { title: "loan_directory", href: "/librarian/loans", icon: ClipboardList },
  {
    title: "library",
    href: "/librarian/library",
    icon: Library,
    subItems: [
      { title: "document_categories", href: "/librarian/library/categories", icon: FolderOpen },
      { title: "document_fields", href: "/librarian/library/document-fields", icon: Sliders },
    ],
  },
  { title: "my_profile", href: "/profile", icon: UserCheck },
];

// Get menu items based on user role
export const getSidebarConfig = (role: UserRole): SidebarMenuItem[] => {
  switch (role) {
    case "super_admin":
      return superAdminMenuItems;
    case "admin":
      return adminMenuItems;
    case "teacher":
      return teacherMenuItems;
    case "student":
      return studentMenuItems;
    case "parent":
      return parentMenuItems;
    case "librarian":
      return librarianMenuItems;
    default:
      return [];
  }
};

// Get dashboard path based on role
export function getDashboardPathByRole(role: UserRole): string {
  switch (role) {
    case "super_admin":
      return "/superadmin/dashboard";
    case "admin":
      return "/admin/dashboard";
    case "teacher":
      return "/teacher/dashboard";
    case "student":
      return "/student/dashboard";
    case "parent":
      return "/parent/dashboard";
    default:
      return "/";
  }
}
