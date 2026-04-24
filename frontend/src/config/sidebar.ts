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
  { title: "Dashboard", href: "/superadmin/dashboard", icon: LayoutDashboard },
  {
    title: "School Directory",
    href: "/superadmin/school-directory",
    icon: Building2,
  },
  { title: "Onboard School", href: "/superadmin/onboard-school", icon: School },
  {
    title: "Billing Status",
    href: "/superadmin/billing-status",
    icon: CreditCard,
  },
  { title: "Settings", href: "/superadmin/settings", icon: Settings },
];

// Admin Menu Items (School Admin)
const adminMenuItems: SidebarMenuItem[] = [
  { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  {
    title: "School",
    href: "/admin/academics",
    icon: School,
    subItems: [
      {
        title: "School Details",
        href: "/admin/school-details",
        icon: Building2,
      },
      { title: "Overview", href: "/admin/academics", icon: LayoutDashboard },
      {
        title: "Grade Levels",
        href: "/admin/academics/grades",
        icon: GraduationCap,
      },
      { title: "Sections", href: "/admin/academics/sections", icon: Users },
      { title: "Subjects", href: "/admin/academics/subjects", icon: BookOpen },
      { title: "Periods", href: "/admin/periods", icon: Clock },
      { title: "Marking Periods", href: "/admin/marking-periods", icon: Layers },
      { title: "Timetable", href: "/admin/timetable", icon: Clock },
      { title: "Bulk Import Timetable", href: "/admin/timetable/import", icon: Upload },
      { title: "Calendar", href: "/admin/events", icon: Calendar },
      { title: "Portal Notes", href: "/admin/portal/notes", icon: FileText },
      { title: "Portal Polls", href: "/admin/portal/polls", icon: BarChart3 },
      { title: "Utilities", href: "#", icon: Settings, isLabel: true },
      { title: "Year-End Rollover", href: "/admin/rollover", icon: RefreshCw },
      { title: "Semester Rollover", href: "/admin/rollover/semester", icon: RefreshCw },
      { title: "Configuration", href: "#", icon: Settings, isLabel: true },
      { title: "Plugins", href: "/admin/settings/plugins", icon: Puzzle },
    ],
  },
  {
    title: "Scheduling",
    href: "/admin/scheduling",
    icon: CalendarCheck,
    subItems: [
      {
        title: "Dashboard",
        href: "/admin/scheduling/dashboard",
        icon: CalendarCheck,
      },
      {
        title: "Courses",
        href: "/admin/scheduling/courses",
        icon: Layers,
      },
      {
        title: "Student Schedule",
        href: "/admin/scheduling/student-schedule",
        icon: CalendarCheck,
      },
      {
        title: "Group Schedule",
        href: "/admin/scheduling/group-schedule",
        icon: Users,
      },
      {
        title: "Group Requests",
        href: "/admin/scheduling/group-requests",
        icon: ClipboardList,
      },
      {
        title: "Group Drops",
        href: "/admin/scheduling/group-drops",
        icon: TrendingDown,
      },
      { title: "Lesson Plans", href: "#", icon: BookOpen, isLabel: true },
      {
        title: "Lesson Plans",
        href: "/admin/scheduling/lesson-plans",
        icon: BookOpen,
      },
      {
        title: "Lesson Plan - Read",
        href: "/admin/scheduling/lesson-plan-read",
        icon: Eye,
      },
      { title: "Reports", href: "#", icon: BarChart3, isLabel: true },
      {
        title: "Print Schedules",
        href: "/admin/scheduling/print-schedules",
        icon: FileText,
      },
      {
        title: "Print Class Pictures",
        href: "/admin/scheduling/print-class-pictures",
        icon: FileText,
      },
      {
        title: "Schedule Report",
        href: "/admin/scheduling/schedule-report",
        icon: FileText,
      },
      {
        title: "Requests Report",
        href: "/admin/scheduling/requests-report",
        icon: FileText,
      },
      {
        title: "Incomplete Schedules",
        href: "/admin/scheduling/incomplete-schedules",
        icon: FileText,
      },
      {
        title: "Add / Drop Report",
        href: "/admin/scheduling/add-drop-report",
        icon: FileText,
      },
    ],
  },
  {
    title: "Students",
    href: "/admin/students",
    icon: GraduationCap,
    subItems: [
      {
        title: "Student Info",
        href: "/admin/students/student-info",
        icon: GraduationCap,
      },
      {
        title: "Add Student",
        href: "/admin/students/add-student",
        icon: Users,
      },
      {
        title: "Bulk Import",
        href: "/admin/students/bulk-import",
        icon: Upload,
      },
      {
        title: "Custom Fields",
        href: "/admin/students/custom-fields",
        icon: Settings,
      },
      {
        title: "Student ID Card",
        href: "/admin/students/id-card",
        icon: CreditCard,
      },
      {
        title: "Certificate",
        href: "/admin/students/certificate-enrollment",
        icon: Award,
      },
      { title: "Reports", href: "#", icon: BarChart3, isLabel: true },
      {
        title: "Print Student Info",
        href: "/admin/students/print-info",
        icon: FileText,
      },
      {
        title: "Print Letters",
        href: "/admin/students/print-letters",
        icon: FileText,
      },
      {
        title: "Student Breakdown",
        href: "/admin/students/breakdown",
        icon: BarChart3,
      },
      {
        title: "Advanced Report",
        href: "/admin/students/advanced-report",
        icon: FileText,
      },
      { title: "Email Students", href: "#", icon: Mail, isLabel: true },
      { title: "Send Email", href: "/admin/email/students", icon: Mail },
    ],
  },
  {
    title: "Email",
    href: "/admin/email/students",
    icon: Mail,
    subItems: [
      { title: "Send to Students", href: "/admin/email/students", icon: Send },
      { title: "Send to Staff", href: "/admin/email/staff", icon: Send },
      { title: "Email Log", href: "/admin/email/log", icon: FileText },
      { title: "Notifications", href: "#", icon: Bell, isLabel: true },
      { title: "Email Notifications", href: "/admin/email/notifications", icon: Bell },

    ],
  },
  {
    title: "Activities",
    href: "/admin/activities",
    icon: Star,
    subItems: [
      { title: "Student Screen", href: "/admin/activities", icon: Star },
      { title: "Add Activity", href: "/admin/activities/add-activity", icon: UserPlus },
      { title: "Enter Eligibility", href: "/admin/activities/enter-eligibility", icon: ClipboardCheck },
      { title: "Reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "Student List", href: "/admin/activities/reports/student-list", icon: Users },
      { title: "Teacher Completion", href: "/admin/activities/reports/teacher-completion", icon: CheckSquare },
      { title: "Setup", href: "#", icon: Settings, isLabel: true },
      { title: "Activities", href: "/admin/activities/setup/activities", icon: Settings },
      { title: "Entry Times", href: "/admin/activities/setup/entry-times", icon: Clock },
    ],
  },
  {
    title: "Discipline",
    href: "/admin/discipline",
    icon: AlertCircle,
    subItems: [
      { title: "Add Referral", href: "/admin/discipline/add-referral", icon: Plus },
      { title: "Referrals", href: "/admin/discipline/referrals", icon: ClipboardList },
      { title: "Reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "Category Breakdown", href: "/admin/discipline/reports/category-breakdown", icon: BarChart3 },
      { title: "Breakdown over Time", href: "/admin/discipline/reports/category-breakdown-time", icon: TrendingUp },
      { title: "Breakdown by Student Field", href: "/admin/discipline/reports/breakdown-student-field", icon: Users },
      { title: "Discipline Log", href: "/admin/discipline/reports/log", icon: FileText },
      { title: "Setup", href: "#", icon: Settings, isLabel: true },
      { title: "Referral Form", href: "/admin/discipline/referral-form", icon: Settings },
    ],
  },
  {
    title: "Quiz",
    href: "/admin/quiz",
    icon: HelpCircle,
    subItems: [
      { title: "Quizzes", href: "/admin/quiz/quizzes", icon: HelpCircle },
      { title: "Questions", href: "/admin/quiz/questions", icon: BookOpen },
      { title: "Premium", href: "#", icon: BarChart3, isLabel: true },
      { title: "Answer Breakdown", href: "/admin/quiz/answer-breakdown", icon: BarChart3 },
      { title: "Configuration", href: "/admin/quiz/configuration", icon: Settings },
    ],
  },
  {
    title: "Staff Absences",
    href: "/admin/staff-absences",
    icon: CalendarOff,
    subItems: [
      { title: "Add Absence", href: "/admin/staff-absences/add-absence", icon: Plus },
      { title: "Absences", href: "/admin/staff-absences/absences", icon: CalendarOff },
      { title: "Reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "Cancelled Classes", href: "/admin/staff-absences/cancelled-classes", icon: BookOpen },
      { title: "Days Absent Breakdown", href: "/admin/staff-absences/breakdown", icon: BarChart3 },
      { title: "Setup", href: "#", icon: Settings, isLabel: true },
      { title: "Absence Fields", href: "/admin/staff-absences/fields", icon: Settings },
    ],
  },
  {
    title: "Teachers",
    href: "/admin/teachers",
    icon: Users,
    subItems: [
      { title: "All Teachers", href: "/admin/teachers", icon: Users },
      { title: "Add Teacher", href: "/admin/teachers/add", icon: Plus },
      {
        title: "Workload",
        href: "/admin/teachers/workload",
        icon: ClipboardList,
      },
      {
        title: "Custom Fields",
        href: "/admin/teachers/custom-fields",
        icon: Settings,
      },
    ],
  },
  {
    title: "Staff",
    href: "/admin/staff",
    icon: Users,
    subItems: [
      { title: "All Staff", href: "/admin/staff", icon: Users },
      { title: "Add Staff", href: "/admin/staff/add-staff", icon: Plus },
      { title: "Bulk Import", href: "/admin/staff/bulk-import", icon: Upload },
      { title: "Custom Fields", href: "/admin/staff/custom-fields", icon: Settings },
      { title: "Settings", href: "/admin/staff/settings", icon: Settings },
    ],
  },
  {
    title: "Parents",
    href: "/admin/parents",
    icon: UserCheck,
    subItems: [
      {
        title: "Parent Info",
        href: "/admin/parents/parent-info",
        icon: UserCheck,
      },
      {
        title: "Add Parent",
        href: "/admin/parents/add-parent",
        icon: UserCheck,
      },
      {
        title: "Associate Parent",
        href: "/admin/parents/associate-parent",
        icon: Users,
      },
      {
        title: "Custom Fields",
        href: "/admin/parents/custom-fields",
        icon: Settings,
      },
      { title: "Email Parents", href: "#", icon: Mail, isLabel: true },
      { title: "Notifications", href: "/admin/email/notifications", icon: Bell },
    ],
  },
  {
    title: "Attendance",
    href: "/admin/attendance",
    icon: CalendarCheck,
    // Base items — always visible (manual attendance workflow)
    // Plugin-gated items (reports, utilities, setup, email) are injected by
    // DashboardLayout when the 'automatic_attendance' plugin is active.
    subItems: [
      { title: "Administration", href: "/admin/attendance/administration", icon: Eye },
      { title: "Add Absences", href: "/admin/attendance/add-absences", icon: Plus },
      { title: "Reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "Teacher Completion", href: "/admin/attendance/teacher-completion", icon: CheckSquare },
      { title: "Average Daily Attendance", href: "/admin/attendance/average-daily", icon: BarChart3 },
      { title: "Attendance Chart", href: "/admin/attendance/chart", icon: BarChart3 },
      { title: "Utilities", href: "#", icon: Settings, isLabel: true },
      { title: "Recalculate Daily Attendance", href: "/admin/attendance/fix-daily", icon: RefreshCw },
      { title: "Delete Duplicate Attendance", href: "/admin/attendance/duplicate", icon: AlertCircle },
      { title: "Setup", href: "#", icon: Settings, isLabel: true },
      { title: "Attendance Codes", href: "/admin/attendance/codes", icon: Settings },
    ],
  },
  {
    title: "Grades",
    href: "/admin/grades",
    icon: Award,
    subItems: [
      { title: "Report Cards", href: "/admin/grades/report-cards", icon: FileText },
      { title: "Transcripts", href: "/admin/grades/transcripts", icon: GraduationCap },
      { title: "Student Grades", href: "/admin/grades/student-grades", icon: GraduationCap },
      { title: "Progress Reports", href: "/admin/grades/progress-reports", icon: ClipboardList },
      { title: "Teacher Completion", href: "/admin/grades/teacher-completion", icon: CheckSquare },
      { title: "Gradebook Breakdown", href: "/admin/grades/gradebook", icon: BarChart3 },
      { title: "Final Grades", href: "/admin/grades/final-grades", icon: CheckSquare },
      { title: "Mass Create Assignments", href: "/admin/grades/mass-create-assignments", icon: ClipboardList },
      { title: "Setup", href: "#", icon: Settings, isLabel: true },
      { title: "Configuration", href: "/admin/grades/configuration", icon: Settings },
      { title: "Grading Scales", href: "/admin/grades/grading-scales", icon: Sliders },
      { title: "Report Card Comments", href: "/admin/grades/report-card-comments", icon: MessageSquare },
      { title: "Comment Codes", href: "/admin/grades/comment-codes", icon: MessageSquare },
      { title: "History Marking Periods", href: "/admin/grades/history-marking-periods", icon: History },
      { title: "Historical Grades", href: "/admin/grades/historical-grades", icon: FileText },
      { title: "Graduation Paths", href: "/admin/grades/graduation-paths", icon: Award },
      { title: "Import Grades", href: "/admin/grades/import-grades", icon: Upload },
      { title: "Reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "Honor Roll", href: "/admin/grades/honor-roll", icon: Award },
      { title: "GPA / Class Ranks", href: "/admin/grades/class-ranks", icon: TrendingUp },
      { title: "Email Students", href: "#", icon: Mail, isLabel: true },
      { title: "Send Report Cards", href: "/admin/grades/email-students", icon: Mail },
      { title: "Email Parents", href: "#", icon: Mail, isLabel: true },
      { title: "Send Report Cards", href: "/admin/grades/email-parents", icon: Mail },
    ],
  },

  {
    title: "Student Billing",
    href: "/admin/fees",
    icon: CreditCard,
    subItems: [
      { title: "Dashboard", href: "/admin/fees", icon: LayoutDashboard },
      { title: "Payments", href: "/admin/fees/payments", icon: Receipt },
      { title: "Generate Fees", href: "/admin/fees/generate", icon: FileText },
      { title: "Fee Overrides", href: "/admin/fees/overrides", icon: Sliders },
      { title: "Student Balances", href: "/admin/fees/student-balances", icon: Users },
      { title: "Fee Structures", href: "/admin/fees/structures", icon: Layers },
      { title: "Fee Categories", href: "/admin/fees/fee-categories", icon: FolderOpen },
      { title: "Print Invoices", href: "/admin/fees/print-invoices", icon: FileText },
      { title: "Print Receipts", href: "/admin/fees/print-receipts", icon: Receipt },
      { title: "Daily Transactions", href: "/admin/billing-elements/daily-transactions", icon: Receipt },
      { title: "Settings", href: "/admin/fees/settings", icon: Settings },
      { title: "Email Students", href: "#", icon: Mail, isLabel: true },
      { title: "Send Balances", href: "/admin/fees/email-students", icon: Mail },
      { title: "Email Parents", href: "#", icon: Mail, isLabel: true },
      { title: "Send Balances", href: "/admin/fees/email-parents", icon: Mail },
    ],
  },
  {
    title: "Billing Elements",
    href: "/admin/billing-elements",
    icon: ShoppingBag,
    subItems: [
      { title: "Elements", href: "/admin/billing-elements", icon: Package },
      { title: "Mass Assign", href: "/admin/billing-elements/mass-assign", icon: Users },
      { title: "Student Elements", href: "/admin/billing-elements/student-elements", icon: UserCheck },
      { title: "Reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "Category Breakdown", href: "/admin/billing-elements/category-breakdown", icon: BarChart3 },
    ],
  },
  {
    title: "Salary",
    href: "/admin/salary",
    icon: DollarSign,
    subItems: [
      { title: "Dashboard", href: "/admin/salary", icon: LayoutDashboard },
      {
        title: "Generate Salaries",
        href: "/admin/salary/generate",
        icon: FileText,
      },
      { title: "Advances", href: "/admin/salary/advances", icon: CreditCard },
      { title: "Settings", href: "/admin/salary/settings", icon: Settings },
    ],
  },
  {
    title: "Accounting",
    href: "/admin/accounting/incomes",
    icon: Calculator,
    subItems: [
      { title: "Incomes", href: "/admin/accounting/incomes", icon: TrendingUp },
      { title: "Expenses", href: "/admin/accounting/expenses", icon: TrendingDown },
      { title: "Staff Payments", href: "/admin/accounting/staff-payments", icon: Receipt },
      { title: "Teacher Hours", href: "/admin/accounting/teacher-hours", icon: Clock },
      { title: "Payees", href: "/admin/accounting/payees", icon: Users },
      { title: "Reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "Daily Transactions", href: "/admin/accounting/daily-transactions", icon: FileText },
      { title: "Staff Balances", href: "/admin/accounting/staff-balances", icon: Users },
      { title: "Setup", href: "#", icon: Settings, isLabel: true },
      { title: "Categories", href: "/admin/accounting/categories", icon: Layers },
    ],
  },
  {
    title: "Library",
    href: "/admin/library",
    icon: Library,
    subItems: [
      { title: "Overview", href: "/admin/library", icon: BookOpen },
      { title: "Document Categories", href: "/admin/library/categories", icon: FolderOpen },
      { title: "Document Fields", href: "/admin/library/document-fields", icon: Sliders },
      { title: "Settings", href: "/admin/library/settings", icon: Settings },
    ],
  },
  {
    title: "Reports",
    href: "/admin/reports/calculations",
    icon: BarChart3,
    subItems: [
      { title: "Calculations", href: "/admin/reports/calculations", icon: Calculator },
      { title: "Calculation Reports", href: "/admin/reports/calculation-reports", icon: FileText },
    ],
  },
  {
    title: "Entry & Exit",
    href: "/admin/entry-exit",
    icon: DoorOpen,
    subItems: [
      { title: "Dashboard", href: "/admin/entry-exit", icon: LayoutDashboard },
      {
        title: "Add Records",
        href: "/admin/entry-exit/add-records",
        icon: UserPlus,
      },
      {
        title: "Records",
        href: "/admin/entry-exit/report",
        icon: ClipboardList,
      },
      {
        title: "Checkpoints",
        href: "/admin/entry-exit/checkpoints",
        icon: Building2,
      },
      {
        title: "Evening Leaves",
        href: "/admin/entry-exit/evening-leaves",
        icon: Clock,
      },
      {
        title: "Mass Evening Leaves",
        href: "/admin/entry-exit/mass-evening-leaves",
        icon: CalendarPlus,
      },
      { title: "Packages", href: "/admin/entry-exit/packages", icon: FileText },
      {
        title: "Automatic Records",
        href: "/admin/entry-exit/automatic-records",
        icon: ClipboardCheck,
      },
      {
        title: "Exceptions",
        href: "/admin/entry-exit/exceptions",
        icon: ShieldX,
      },
      {
        title: "Add Exceptions",
        href: "/admin/entry-exit/add-exceptions",
        icon: ShieldPlus,
      },
      {
        title: "Take Attendance",
        href: "/admin/entry-exit/take-attendance",
        icon: UserCheck,
      },
    ],
  },
  {
    title: "Hostel",
    href: "/admin/hostel",
    icon: BedDouble,
    subItems: [
      { title: "Dashboard", href: "/admin/hostel", icon: LayoutDashboard },
      { title: "Buildings", href: "/admin/hostel/buildings", icon: Building2 },
      { title: "Rooms", href: "/admin/hostel/rooms", icon: DoorOpen },
      { title: "Assignments", href: "/admin/hostel/assignments", icon: Users },
      { title: "Visits", href: "/admin/hostel/visits", icon: Eye },
      { title: "Fees", href: "/admin/hostel/fees", icon: DollarSign },
      { title: "Room Fields", href: "/admin/hostel/fields", icon: Settings },
      { title: "Configuration", href: "/admin/hostel/settings", icon: Settings },
    ],
  },
  {
    title: "Resources",
    href: "/admin/resources/links",
    icon: FolderOpen,
    subItems: [
      { title: "Resources", href: "/admin/resources/links", icon: Link2 },
      { title: "Dashboards", href: "/admin/resources/dashboards", icon: LayoutDashboard },
      { title: "School Inventory", href: "/admin/resources/school-inventory", icon: Package },
      { title: "Inventory Snapshots", href: "/admin/resources/inventory-snapshots", icon: Camera },
    ],
  },
  {
    title: "Settings",
    href: "/admin/settings",
    icon: Settings,
    subItems: [
      { title: "General", href: "/admin/settings", icon: Settings },
      { title: "Campuses", href: "/admin/settings/campuses", icon: Building2 },
      {
        title: "Academic Years",
        href: "/admin/settings/academic-years",
        icon: Calendar,
      },
      { title: "Services", href: "/admin/settings/services", icon: Settings },
      { title: "Email Reminders", href: "/admin/settings/email-reminders", icon: Bell },
      { title: "Email SMTP", href: "/admin/settings/email-smtp", icon: Mail },
      { title: "Public Pages", href: "/admin/settings/public-pages", icon: Globe },
    ],
  },
];

// Teacher Menu Items
const teacherMenuItems: SidebarMenuItem[] = [
  { title: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard },
  {
    title: "School",
    href: "/teacher/school-information",
    icon: School,
    subItems: [
      { title: "School Information", href: "/teacher/school-information", icon: Building2 },
      { title: "Calendar", href: "/teacher/events", icon: Calendar },
      { title: "Marking Periods", href: "/teacher/marking-periods", icon: Layers },
      { title: "Periods", href: "/teacher/periods", icon: Clock },
    ],
  },
  {
    title: "Students",
    href: "/teacher/students",
    icon: GraduationCap,
    subItems: [
      { title: "Student Info", href: "/teacher/students", icon: GraduationCap },
      { title: "Associated Parents", href: "/teacher/students/associated-parents", icon: UserCheck },
      { title: "Reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "Advanced Report", href: "/teacher/students/advanced-report", icon: FileText },
      { title: "Print Student Labels", href: "/teacher/students/student-labels", icon: FileText },
      { title: "Print Letters", href: "/teacher/students/print-letters", icon: FileText },
    ],
  },
  {
    title: "Scheduling",
    href: "/teacher/scheduling/schedule",
    icon: CalendarCheck,
    subItems: [
      { title: "Schedule", href: "/teacher/scheduling/schedule", icon: CalendarCheck },
      { title: "Courses", href: "/teacher/scheduling/courses", icon: Layers },
      { title: "Reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "Print Schedules", href: "/teacher/scheduling/print-schedules", icon: FileText },
      { title: "Print Class Pictures", href: "/teacher/scheduling/print-class-pictures", icon: Camera },
    ],
  },
  {
    title: "Grades",
    href: "/teacher/grades",
    icon: Award,
    subItems: [
      { title: "Input Final Grades", href: "/teacher/grades/input-final-grades", icon: CheckSquare },
      { title: "Report Cards", href: "/teacher/grades/report-cards", icon: FileText },
      { title: "Gradebook", href: "#", icon: BookOpen, isLabel: true },
      { title: "Grades", href: "/teacher/grades/gradebook", icon: Award },
      { title: "Assignments", href: "/teacher/grades/assignments", icon: ClipboardList },
      { title: "Anomalous Grades", href: "/teacher/grades/anomalous-grades", icon: AlertCircle },
      { title: "Progress Reports", href: "/teacher/grades/progress-reports", icon: ClipboardList },
      { title: "Grade Breakdown", href: "/teacher/grades/gradebook-breakdown", icon: BarChart3 },
      { title: "Reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "Student Grades", href: "/teacher/grades/student-grades", icon: GraduationCap },
      { title: "Final Grades", href: "/teacher/grades/final-grades", icon: CheckSquare },
      { title: "GPA / Class Rank List", href: "/teacher/grades/gpa-rank-list", icon: TrendingUp },
      { title: "Setup", href: "#", icon: Settings, isLabel: true },
      { title: "Configuration", href: "/teacher/grades/configuration", icon: Settings },
      { title: "Grading Scales", href: "/teacher/grades/grading-scales", icon: Sliders },
      { title: "Report Card Comments", href: "/teacher/grades/report-card-comments", icon: MessageSquare },
      { title: "Comment Codes", href: "/teacher/grades/comment-codes", icon: MessageSquare },
    ],
  },
  {
    title: "Attendance",
    href: "/teacher/attendance",
    icon: CalendarCheck,
    subItems: [
      { title: "Take Attendance", href: "/teacher/attendance/take-attendance", icon: UserCheck },
      { title: "Attendance Chart", href: "/teacher/attendance/daily-summary", icon: BarChart3 },
    ],
  },

  {
    title: "Activities",
    href: "/teacher/activities",
    icon: Star,
    subItems: [
      { title: "Enter Eligibility", href: "/teacher/activities/eligibility", icon: Star },
    ],
  },

  {
    title: "Discipline",
    href: "/teacher/discipline",
    icon: AlertCircle,
    subItems: [
      { title: "Add Referral", href: "/teacher/discipline/add-referral", icon: Plus },
      { title: "Referrals", href: "/teacher/discipline/referrals", icon: ClipboardList },
    ],
  },
  {
    title: "Accounting",
    href: "/teacher/accounting",
    icon: DollarSign,
    subItems: [
      { title: "Staff Payroll", href: "#", icon: DollarSign, isLabel: true },
      { title: "Salaries", href: "/teacher/accounting/salaries", icon: DollarSign },
      { title: "Staff Payments", href: "/teacher/accounting/staff-payments", icon: DollarSign },
      { title: "Reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "Print Statements", href: "/teacher/accounting/print-statements", icon: FileText },
    ],
  },

  {
    title: "Resources",
    href: "/teacher/learning-resources",
    icon: FolderOpen,
    subItems: [
      { title: "Resources", href: "/teacher/resources", icon: Link2 },
      {
        title: "Learning Resources",
        href: "/teacher/learning-resources",
        icon: Upload,
      },
      // { title: 'Content Library', href: '/teacher/library', icon: Library },
      { title: "Class Reports", href: "/teacher/reports", icon: BarChart3 },
    ],
  },
  {
    title: "Portal",
    href: "/teacher/portal/notes",
    icon: Megaphone,
    subItems: [
      { title: "Announcements", href: "/teacher/portal/notes", icon: FileText },
      { title: "Polls", href: "/teacher/portal/polls", icon: BarChart3 },
    ],
  },
  {
    title: "Academic Management",
    href: "/teacher/timetable",
    icon: Clock,
    subItems: [
      { title: "My Timetable", href: "/teacher/timetable", icon: Clock },
      { title: "Subjects", href: "/teacher/subjects", icon: BookOpen },
      { title: "Class Diary", href: "/teacher/class-diary", icon: ClipboardList },
      { title: "Lesson Plan - Add", href: "/teacher/lesson-plans", icon: BookOpen },
      { title: "Lesson Plan - Read", href: "/teacher/lesson-plan-read", icon: Eye },
    ],
  },

  {
    title: "Student Learning",
    href: "/teacher/assignments",
    icon: ClipboardList,
    subItems: [
      { title: "Assignments", href: "/teacher/assignments", icon: ClipboardList },
      { title: "Submissions", href: "/teacher/submissions", icon: CheckSquare },
      { title: "Exams & Grading", href: "/teacher/exams", icon: Award },
      { title: "Quizzes", href: "/teacher/quiz", icon: HelpCircle },
    ],
  },


  { title: "Settings", href: "/teacher/settings", icon: Settings },
];

// Student Menu Items — mirrors RosarioSIS student menu structure
const studentMenuItems: SidebarMenuItem[] = [
  { title: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  {
    title: "School",
    href: "/student/school-information",
    icon: School,
    subItems: [
      { title: "School Information", href: "/student/school-information", icon: Building2 },
      { title: "Calendar", href: "/student/events", icon: Calendar },
      { title: "Marking Periods", href: "/student/marking-periods", icon: Layers },
    ],
  },
  {
    title: "Portal",
    href: "/student/portal/notes",
    icon: Megaphone,
    subItems: [
      { title: "Announcements", href: "/student/portal/notes", icon: FileText },
      { title: "Polls", href: "/student/portal/polls", icon: BarChart3 },
    ],
  },
  { title: "Students", href: "/student/students", icon: UserCheck },
  {
    title: "Scheduling",
    href: "/student/scheduling/schedule",
    icon: CalendarCheck,
    subItems: [
      { title: "Schedule", href: "/student/scheduling/schedule", icon: CalendarCheck },
      { title: "Student Requests", href: "/student/scheduling/student-requests", icon: ClipboardList },
      { title: "Courses", href: "/student/scheduling/courses", icon: BookOpen },
      { title: "Lesson Plans", href: "#", icon: BookOpen, isLabel: true },
      { title: "Lesson Plan - Read", href: "/student/scheduling/lesson-plan-read", icon: Eye },
      { title: "Reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "Print Schedules", href: "/student/scheduling/print-schedules", icon: FileText },
      { title: "Class Pictures", href: "/student/scheduling/print-class-pictures", icon: Camera },
    ],
  },
  {
    title: "Grades",
    href: "/student/grades/student-grades",
    icon: Award,
    subItems: [
      { title: "Gradebook Grades", href: "/student/grades/student-grades", icon: Award },
      { title: "Assignments", href: "/student/assignments", icon: ClipboardList },
      { title: "Final Grades", href: "/student/grades/final-grades", icon: CheckSquare },
      { title: "Report Cards", href: "/student/grades/report-cards", icon: FileText },
      { title: "Progress Reports", href: "/student/grades/progress-reports", icon: ClipboardList },
      { title: "Transcripts", href: "/student/grades/transcripts", icon: GraduationCap },
      { title: "GPA / Class Rank", href: "/student/grades/gpa-rank-list", icon: TrendingUp },
    ],
  },
  {
    title: "Attendance",
    href: "/student/attendance",
    icon: CalendarCheck,
    subItems: [
      { title: "Daily Summary", href: "/student/attendance", icon: CalendarCheck },
    ],
  },
  {
    title: "Student Billing",
    href: "/student/billing/fees",
    icon: Receipt,
    subItems: [
      { title: "Fees", href: "/student/billing/fees", icon: Receipt },
      { title: "Payments", href: "/student/billing/payments", icon: CreditCard },
      { title: "Reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "Daily Transactions", href: "/student/billing/daily-transactions", icon: DollarSign },
      { title: "Print Statements", href: "/student/billing/print-statements", icon: FileText },
    ],
  },
  {
    title: "Discipline",
    href: "/student/discipline",
    icon: AlertCircle,
    subItems: [
      { title: "Referrals", href: "/student/discipline", icon: ClipboardList },
    ],
  },
  { title: "Activities", href: "/student/activities", icon: Star },
  { title: "Library", href: "/student/library", icon: Library },
  { title: "Hostel", href: "/student/hostel", icon: BedDouble },
  {
    title: "Resources",
    href: "/student/learning-resources",
    icon: FolderOpen,
    subItems: [
      { title: "Resources", href: "/student/resources", icon: Link2 },
      { title: "Learning Resources", href: "/student/learning-resources", icon: Upload },
      { title: "Syllabus", href: "/student/syllabus", icon: BookOpen },
      { title: "Learning Materials", href: "/student/materials", icon: Library },
    ],
  },
  {
    title: "Profile",
    href: "/student/profile",
    icon: UserCheck,
    subItems: [
      { title: "ID Card", href: "/student/id-card", icon: CreditCard },
      { title: "My Profile", href: "/student/profile", icon: UserCheck },
    ],
  },
];

// Parent Menu Items — mirrors RosarioSIS parent menu structure
const parentMenuItems: SidebarMenuItem[] = [
  { title: "Dashboard", href: "/parent/dashboard", icon: LayoutDashboard },
  {
    title: "School",
    href: "/parent/school-information",
    icon: School,
    subItems: [
      { title: "School Information", href: "/parent/school-information", icon: Building2 },
      { title: "Calendar", href: "/parent/events", icon: Calendar },
      { title: "Marking Periods", href: "/parent/marking-periods", icon: Layers },
    ],
  },
  {
    title: "Portal",
    href: "/parent/portal/notes",
    icon: Megaphone,
    subItems: [
      { title: "Announcements", href: "/parent/portal/notes", icon: FileText },
      { title: "Polls", href: "/parent/portal/polls", icon: BarChart3 },
    ],
  },
  { title: "Students", href: "/parent/students", icon: GraduationCap },
  {
    title: "Scheduling",
    href: "/parent/scheduling/schedule",
    icon: CalendarCheck,
    subItems: [
      { title: "Schedule", href: "/parent/scheduling/schedule", icon: CalendarCheck },
      { title: "Student Requests", href: "/parent/scheduling/student-requests", icon: ClipboardList },
      { title: "Courses", href: "/parent/scheduling/courses", icon: Layers },
      { title: "Lesson Plans", href: "#", icon: BookOpen, isLabel: true },
      { title: "Lesson Plan - Read", href: "/parent/scheduling/lesson-plan-read", icon: Eye },
      { title: "Reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "Print Schedules", href: "/parent/scheduling/print-schedules", icon: FileText },
      { title: "Class Pictures", href: "/parent/scheduling/print-class-pictures", icon: Camera },
    ],
  },
  {
    title: "Grades",
    href: "/parent/grades/student-grades",
    icon: Award,
    subItems: [
      { title: "Gradebook Grades", href: "/parent/grades/student-grades", icon: Award },
      { title: "Assignments", href: "/parent/grades/student-assignments", icon: ClipboardList },
      { title: "Final Grades", href: "/parent/grades/final-grades", icon: CheckSquare },
      { title: "Report Cards", href: "/parent/grades/report-cards", icon: FileText },
      { title: "Progress Reports", href: "/parent/grades/progress-reports", icon: ClipboardList },
      { title: "Transcripts", href: "/parent/grades/transcripts", icon: GraduationCap },
      { title: "GPA / Class Rank", href: "/parent/grades/gpa-rank-list", icon: TrendingUp },
    ],
  },
  {
    title: "Attendance",
    href: "/parent/attendance",
    icon: CalendarCheck,
    subItems: [
      { title: "Daily Summary", href: "/parent/attendance", icon: CalendarCheck },
    ],
  },
  {
    title: "Student Billing",
    href: "/parent/billing/fees",
    icon: Receipt,
    subItems: [
      { title: "Fees", href: "/parent/billing/fees", icon: Receipt },
      { title: "Payments", href: "/parent/billing/payments", icon: CreditCard },
      { title: "Reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "Daily Transactions", href: "/parent/billing/daily-transactions", icon: DollarSign },
      { title: "Print Statements", href: "/parent/billing/print-statements", icon: FileText },
    ],
  },
  { title: "Class Diary", href: "/parent/class-diary", icon: BookOpen },
  { title: "Timetable", href: "/parent/timetable", icon: Clock },

  {
    title: "Discipline",
    href: "/parent/discipline",
    icon: AlertCircle,
    subItems: [
      { title: "Referrals", href: "/parent/discipline", icon: ClipboardList },
    ],
  },
  { title: "Activities", href: "/parent/activities", icon: Star },
  { title: "ID Card", href: "/parent/id-card", icon: CreditCard },
  {
    title: "Resources",
    href: "/parent/resources",
    icon: FolderOpen,
    subItems: [
      { title: "Resources", href: "/parent/resources", icon: Link2 },
    ],
  },
  { title: "Settings", href: "/parent/settings", icon: Settings },
];

// Librarian Menu Items
const librarianMenuItems: SidebarMenuItem[] = [
  { title: "Dashboard", href: "/librarian/dashboard", icon: LayoutDashboard },
  { title: "Books", href: "/librarian/books", icon: BookOpen },
  { title: "Loan Directory", href: "/librarian/loans", icon: ClipboardList },
  {
    title: "Library",
    href: "/librarian/library",
    icon: Library,
    subItems: [
      { title: "Document Categories", href: "/librarian/library/categories", icon: FolderOpen },
      { title: "Document Fields", href: "/librarian/library/document-fields", icon: Sliders },
    ],
  },
  { title: "My Profile", href: "/profile", icon: UserCheck },
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
