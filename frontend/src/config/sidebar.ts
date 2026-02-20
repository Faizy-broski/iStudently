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
  RefreshCw,
  MessageSquare,
  History,
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
      { title: "Calendar", href: "/admin/events", icon: Calendar },
      { title: "Portal Notes", href: "/admin/portal/notes", icon: FileText },
      { title: "Portal Polls", href: "/admin/portal/polls", icon: BarChart3 },
      { title: "Utilities", href: "#", icon: Settings, isLabel: true },
      { title: "Year-End Rollover", href: "/admin/rollover", icon: RefreshCw },
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
    ],
  },
  {
    title: "Attendance",
    href: "/admin/attendance",
    icon: CalendarCheck,
    subItems: [
      { title: "Take Attendance", href: "/admin/attendance/take-attendance", icon: UserCheck },
      { title: "Administration", href: "/admin/attendance", icon: Eye },
      { title: "Add Absences", href: "/admin/attendance/add-absences", icon: Plus },
      { title: "Class Diary - Read", href: "/admin/attendance/class-diary", icon: BookOpen },
      { title: "Class Diary - Write", href: "/admin/attendance/class-diary-write", icon: ClipboardList },
      { title: "Reports", href: "#", icon: BarChart3, isLabel: true },
      { title: "Teacher Completion", href: "/admin/attendance/teacher-completion", icon: CheckSquare },
      { title: "Average Daily Attendance", href: "/admin/attendance/average-daily", icon: TrendingUp },
      { title: "Attendance Chart", href: "/admin/attendance/chart", icon: BarChart3 },
      { title: "Attendance Summary", href: "/admin/attendance/summary", icon: FileText },
      { title: "Print Attendance Sheets", href: "/admin/attendance/print-sheets", icon: ClipboardList },
      { title: "Utilities", href: "#", icon: Settings, isLabel: true },
      { title: "Recalculate Daily Attendance", href: "/admin/attendance/recalculate", icon: Calculator },
      { title: "Delete Duplicate Attendance", href: "/admin/attendance/delete-duplicates", icon: Award },
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
    ],
  },
  { title: "Assignments", href: "/admin/assignments", icon: ClipboardList },
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
      { title: "Settings", href: "/admin/fees/settings", icon: Settings },
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
      { title: "Daily Transactions", href: "/admin/billing-elements/daily-transactions", icon: Receipt },
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
      { title: "Settings", href: "/admin/library/settings", icon: Settings },
    ],
  },
  { title: "Reports", href: "/admin/reports", icon: BarChart3 },
  {
    title: "Entry & Exit",
    href: "/admin/entry-exit",
    icon: DoorOpen,
    subItems: [
      { title: "Dashboard", href: "/admin/entry-exit", icon: LayoutDashboard },
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
      { title: "Packages", href: "/admin/entry-exit/packages", icon: FileText },
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
    ],
  },
  {
    title: "Resources",
    href: "/admin/resources/links",
    icon: FolderOpen,
    subItems: [
      { title: "Resources", href: "/admin/resources/links", icon: Link2 },
      { title: "Dashboards", href: "/admin/resources/dashboards", icon: LayoutDashboard },
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
    ],
  },
];

// Teacher Menu Items
const teacherMenuItems: SidebarMenuItem[] = [
  { title: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard },
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
      { title: "Calendar", href: "/admin/events", icon: Calendar },
      { title: "Take Attendance", href: "/teacher/attendance", icon: UserCheck },
      { title: "Subjects", href: "/teacher/subjects", icon: BookOpen },
      { title: "Class Diary - Read", href: "/admin/attendance/class-diary", icon: BookOpen },
      { title: "Class Diary - Write", href: "/admin/attendance/class-diary-write", icon: ClipboardList },
      { title: "Lesson Plan - Add", href: "/teacher/lesson-plans", icon: BookOpen },
      { title: "Lesson Plan - Read", href: "/teacher/lesson-plan-read", icon: Eye },
    ],
  },
  {
    title: "Student Learning",
    href: "/teacher/assignments",
    icon: ClipboardList,
    subItems: [
      {
        title: "Assignments",
        href: "/teacher/assignments",
        icon: ClipboardList,
      },
      { title: "Submissions", href: "/teacher/submissions", icon: CheckSquare },
      { title: "Exams & Grading", href: "/teacher/exams", icon: Award },
      { title: "Gradebook", href: "/teacher/grades/gradebook", icon: BookOpen },
      { title: "Import Grades", href: "/teacher/grades/import-grades", icon: Upload },
      { title: "Progress Reports", href: "/teacher/grades/progress-reports", icon: ClipboardList },
      { title: "Report Cards", href: "/teacher/grades/report-cards", icon: FileText },
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
  { title: "Students", href: "/teacher/students", icon: GraduationCap },
  { title: "Settings", href: "/teacher/settings", icon: Settings },
];

// Student Menu Items
const studentMenuItems: SidebarMenuItem[] = [
  { title: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  {
    title: "Portal",
    href: "/student/portal/notes",
    icon: Megaphone,
    subItems: [
      { title: "Announcements", href: "/student/portal/notes", icon: FileText },
      { title: "Polls", href: "/student/portal/polls", icon: BarChart3 },
    ],
  },
  {
    title: "My Classes",
    href: "/student/timetable",
    icon: BookOpen,
    subItems: [
      { title: "Timetable", href: "/student/timetable", icon: Clock },
      { title: "Calendar", href: "/admin/events", icon: Calendar },
      { title: "Attendance", href: "/student/attendance", icon: CalendarCheck },
      { title: "Class Diary", href: "/admin/attendance/class-diary", icon: BookOpen },
    ],
  },
  {
    title: "Work & Grades",
    href: "/student/assignments",
    icon: ClipboardList,
    subItems: [
      {
        title: "Assignments",
        href: "/student/assignments",
        icon: ClipboardList,
      },
      { title: "Exams", href: "/student/exams", icon: FileText },
      { title: "Report Cards", href: "/student/grades/report-cards", icon: Award },
      { title: "Transcripts", href: "/student/grades/transcripts", icon: GraduationCap },
    ],
  },
  {
    title: "Resources",
    href: "/student/learning-resources",
    icon: FolderOpen,
    subItems: [
      { title: "Resources", href: "/student/resources", icon: Link2 },
      {
        title: "Learning Resources",
        href: "/student/learning-resources",
        icon: Upload,
      },
      { title: "Syllabus", href: "/student/syllabus", icon: BookOpen },
      {
        title: "Learning Materials",
        href: "/student/materials",
        icon: Library,
      },
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
  { title: "Fees", href: "/student/fees", icon: Receipt },
];

// Parent Menu Items - Separate pages for each feature
const parentMenuItems: SidebarMenuItem[] = [
  { title: "Dashboard", href: "/parent/dashboard", icon: LayoutDashboard },
  {
    title: "Portal",
    href: "/parent/portal/notes",
    icon: Megaphone,
    subItems: [
      { title: "Announcements", href: "/parent/portal/notes", icon: FileText },
      { title: "Polls", href: "/parent/portal/polls", icon: BarChart3 },
    ],
  },
  { title: "Academics", href: "/parent/academics", icon: GraduationCap },
  { title: "Calendar", href: "/admin/events", icon: Calendar },
  { title: "Attendance", href: "/parent/attendance", icon: CalendarCheck },
  { title: "Class Diary", href: "/admin/attendance/class-diary", icon: BookOpen },
  { title: "Timetable", href: "/parent/timetable", icon: Clock },
  { title: "Homework", href: "/parent/homework", icon: ClipboardList },
  { title: "Fees", href: "/parent/fees", icon: CreditCard },
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
  // Reuse Profile/Settings
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
