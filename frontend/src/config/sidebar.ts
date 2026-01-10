import {
  LayoutDashboard,
  Users,
  GraduationCap,
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
  type LucideIcon,
} from 'lucide-react'
import { UserRole } from '@/types'

export interface SidebarMenuItem {
  title: string
  href: string
  icon: LucideIcon
  badge?: string | number
}

export interface SidebarConfig {
  role: UserRole
  menuItems: SidebarMenuItem[]
}

// Super Admin Menu Items
const superAdminMenuItems: SidebarMenuItem[] = [
  { title: 'Dashboard', href: '/superadmin/dashboard', icon: LayoutDashboard },
  { title: 'School Directory', href: '/superadmin/school-directory', icon: Building2 },
  { title: 'Onboard School', href: '/superadmin/onboard-school', icon: School },
  { title: 'Billing Status', href: '/superadmin/billing-status', icon: CreditCard },
  { title: 'Settings', href: '/superadmin/settings', icon: Settings },
]

// Admin Menu Items (School Admin)
const adminMenuItems: SidebarMenuItem[] = [
  { title: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { title: 'Students', href: '/admin/students', icon: GraduationCap },
  { title: 'Teachers', href: '/admin/teachers', icon: Users },
  { title: 'Parents', href: '/admin/parents', icon: UserCheck },
  { title: 'Academics', href: '/admin/academics', icon: BookOpen },
  { title: 'Attendance', href: '/admin/attendance', icon: CalendarCheck },
  { title: 'Exams', href: '/admin/exams', icon: FileText },
  { title: 'Assignments', href: '/admin/assignments', icon: ClipboardList },
  { title: 'Fees', href: '/admin/fees', icon: CreditCard },
  { title: 'Timetable', href: '/admin/timetable', icon: Clock },
  { title: 'Library', href: '/admin/library', icon: Library },
  { title: 'Events', href: '/admin/events', icon: Calendar },
  { title: 'Reports', href: '/admin/reports', icon: BarChart3 },
  { title: 'Settings', href: '/admin/settings', icon: Settings },
]

// Teacher Menu Items
const teacherMenuItems: SidebarMenuItem[] = [
  { title: 'Dashboard', href: '/teacher/dashboard', icon: LayoutDashboard },
  { title: 'Students', href: '/teacher/students', icon: GraduationCap },
  { title: 'Academics', href: '/teacher/academics', icon: BookOpen },
  { title: 'Attendance', href: '/teacher/attendance', icon: CalendarCheck },
  { title: 'Exams', href: '/teacher/exams', icon: FileText },
  { title: 'Assignments', href: '/teacher/assignments', icon: ClipboardList },
  { title: 'Timetable', href: '/teacher/timetable', icon: Clock },
  { title: 'Library', href: '/teacher/library', icon: Library },
  { title: 'Events', href: '/teacher/events', icon: Calendar },
  { title: 'Reports', href: '/teacher/reports', icon: BarChart3 },
  { title: 'Settings', href: '/teacher/settings', icon: Settings },
]

// Student Menu Items
const studentMenuItems: SidebarMenuItem[] = [
  { title: 'Dashboard', href: '/student/dashboard', icon: LayoutDashboard },
  { title: 'Academics', href: '/student/academics', icon: BookOpen },
  { title: 'Attendance', href: '/student/attendance', icon: CalendarCheck },
  { title: 'Exams', href: '/student/exams', icon: FileText },
  { title: 'Assignments', href: '/student/assignments', icon: ClipboardList },
  { title: 'Timetable', href: '/student/timetable', icon: Clock },
  { title: 'Library', href: '/student/library', icon: Library },
  { title: 'Events', href: '/student/events', icon: Calendar },
  { title: 'Settings', href: '/student/settings', icon: Settings },
]

// Parent Menu Items
const parentMenuItems: SidebarMenuItem[] = [
  { title: 'Dashboard', href: '/parent/dashboard', icon: LayoutDashboard },
  { title: 'Students', href: '/parent/students', icon: GraduationCap },
  { title: 'Academics', href: '/parent/academics', icon: BookOpen },
  { title: 'Attendance', href: '/parent/attendance', icon: CalendarCheck },
  { title: 'Exams', href: '/parent/exams', icon: FileText },
  { title: 'Assignments', href: '/parent/assignments', icon: ClipboardList },
  { title: 'Fees', href: '/parent/fees', icon: CreditCard },
  { title: 'Timetable', href: '/parent/timetable', icon: Clock },
  { title: 'Events', href: '/parent/events', icon: Calendar },
  { title: 'Settings', href: '/parent/settings', icon: Settings },
]

// Get menu items based on user role
export function getMenuItemsByRole(role: UserRole): SidebarMenuItem[] {
  switch (role) {
    case 'super_admin':
      return superAdminMenuItems
    case 'admin':
      return adminMenuItems
    case 'teacher':
      return teacherMenuItems
    case 'student':
      return studentMenuItems
    case 'parent':
      return parentMenuItems
    default:
      return []
  }
}

// Get dashboard path based on role
export function getDashboardPathByRole(role: UserRole): string {
  switch (role) {
    case 'super_admin':
      return '/superadmin/dashboard'
    case 'admin':
      return '/admin/dashboard'
    case 'teacher':
      return '/teacher/dashboard'
    case 'student':
      return '/student/dashboard'
    case 'parent':
      return '/parent/dashboard'
    default:
      return '/'
  }
}
