/**
 * Plugin Registry
 *
 * Each entry defines a plugin that campus admins can activate on demand.
 * When active:
 *   - sidebarInjections are merged into the matching parent nav section
 *   - The plugin's backend automation (cron etc.) is enabled via school_settings
 *
 * Adding a new plugin = append one object here. No DB migration needed.
 */

import {
  UserCheck,
  BarChart3,
  CheckSquare,
  TrendingUp,
  FileText,
  ClipboardList,
  Settings,
  Calculator,
  Award,
  Mail,
  CalendarDays,
  ShieldAlert,
  CalendarRange,
  FileImage,
  Globe,
  Users,
  LayoutTemplate,
  Sigma,
  Mic,
  UserX,
  Tag,
  Hash,
  Type,
  MessageSquare,
  Copy,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { SidebarMenuItem } from './sidebar'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PluginSidebarInjection {
  /** Must match `title` of an existing top-level SidebarMenuItem */
  parentTitle: string
  /** Items appended to that parent's subItems when plugin is active */
  items: SidebarMenuItem[]
}

export interface PluginDefinition {
  id: string
  name: string
  description: string
  icon: LucideIcon
  category: string
  /** Deep-link to the plugin's own configuration page */
  settingsHref?: string
  sidebarInjections: PluginSidebarInjection[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export const PLUGIN_REGISTRY: PluginDefinition[] = [
  // ── Automatic Attendance ─────────────────────────────────────────────────
  {
    id: 'automatic_attendance',
    name: 'Automatic Attendance',
    description:
      'Automatically marks all enrolled active students as Present after a configurable hour each school day. Teachers only need to mark absences. Skips holidays defined in the attendance calendar.',
    icon: UserCheck,
    category: 'Attendance',
    settingsHref: '/admin/settings/automatic-attendance',
    sidebarInjections: [
      {
        parentTitle: 'Attendance',
        items: [
          // Reports group
          { title: 'Reports', href: '#', icon: BarChart3, isLabel: true },
          { title: 'Teacher Completion', href: '/admin/attendance/teacher-completion', icon: CheckSquare },
          { title: 'Average Daily Attendance', href: '/admin/attendance/average-daily', icon: TrendingUp },
          { title: 'Attendance Chart', href: '/admin/attendance/chart', icon: BarChart3 },
          { title: 'Attendance Summary', href: '/admin/attendance/summary', icon: FileText },
          { title: 'Print Attendance Sheets', href: '/admin/attendance/print-sheets', icon: ClipboardList },
          // Utilities group
          { title: 'Utilities', href: '#', icon: Settings, isLabel: true },
          { title: 'Take Missing Attendance', href: '/admin/attendance/take-missing', icon: UserCheck },
          { title: 'Recalculate Daily Attendance', href: '/admin/attendance/recalculate', icon: Calculator },
          { title: 'Delete Duplicate Attendance', href: '/admin/attendance/delete-duplicates', icon: Award },
          // Setup group
          { title: 'Setup', href: '#', icon: Settings, isLabel: true },
          { title: 'Attendance Codes', href: '/admin/attendance/codes', icon: Settings },
          // Email parents group
          { title: 'Email Parents', href: '#', icon: Mail, isLabel: true },
          { title: 'Send Days Absent', href: '/admin/attendance/email-parents', icon: Mail },
        ],
      },
    ],
  },

  // ── Calendar Schedule View ───────────────────────────────────────────────
  {
    id: 'calendar_schedule_view',
    name: 'Calendar Schedule View',
    description:
      'Adds a "Schedule View" toggle to the School Events & Calendar page. Each school day displays the timetable periods for that day. No extra configuration needed — activate and use the toggle directly on the calendar.',
    icon: CalendarDays,
    category: 'Attendance',
    settingsHref: '/admin/events',
    sidebarInjections: [],
  },

  // ── Discipline Score ─────────────────────────────────────────────────────
  {
    id: 'discipline_score',
    name: 'Discipline Score',
    description:
      'Tracks a 100-point discipline score per student. Score automatically decrements when discipline referrals are submitted, based on penalty markers set in the referral form fields. Displayed as a tab on the Student Info page with color-coded status.',
    icon: ShieldAlert,
    category: 'Discipline',
    settingsHref: '/admin/discipline/referral-form',
    sidebarInjections: [],
  },

  // ── iCalendar ────────────────────────────────────────────────────────────
  {
    id: 'icalendar',
    name: 'iCalendar',
    description:
      'Adds a subscribe link to the School Events & Calendar page. Sync school events and class schedules with Outlook, Google Calendar, Thunderbird, or any calendar app that supports .ics feeds.',
    icon: CalendarRange,
    category: 'Calendar',
    settingsHref: '/admin/events',
    sidebarInjections: [],
  },

  // ── Email SMTP ───────────────────────────────────────────────────────────
  {
    id: 'email_smtp',
    name: 'Email SMTP',
    description:
      'Send emails using a custom SMTP server instead of the system default. Configure per-campus outgoing mail settings including host, port, SSL/TLS, credentials, and the From address shown to recipients.',
    icon: Mail,
    category: 'Email',
    settingsHref: '/admin/settings/email-smtp',
    sidebarInjections: [],
  },

  // ── PDF Header / Footer ──────────────────────────────────────────────────
  {
    id: 'pdf_header_footer',
    name: 'PDF Header Footer',
    description:
      'Adds a custom header and footer to printed pages and PDF reports. Configure HTML content for header/footer, adjust top/bottom margins, and optionally exclude the header/footer from browser print dialogs.',
    icon: FileImage,
    category: 'Reports',
    settingsHref: '/admin/settings/pdf-header-footer',
    sidebarInjections: [
      {
        parentTitle: 'Settings',
        items: [
          { title: 'PDF Header Footer', href: '/admin/settings/pdf-header-footer', icon: FileImage },
        ],
      },
    ],
  },

  // ── Public Pages ─────────────────────────────────────────────────────────
  {
    id: 'public_pages',
    name: 'Public Pages',
    description:
      'Publish school information to unauthenticated visitors. Choose which pages are visible: School info, Events, Marking Periods, Courses, Activities, Staff directory, and a custom page. Each campus gets its own public URL at /p/[slug].',
    icon: Globe,
    category: 'Communication',
    settingsHref: '/admin/settings/public-pages',
    sidebarInjections: [],
  },

  // ── Previous Next Student ─────────────────────────────────────────────────
  {
    id: 'previous_next_student',
    name: 'Previous Next Student',
    description:
      'Adds Previous and Next navigation buttons to the Student Details page so admins can step through students one by one without returning to the list. Fetches the full student list for in-order navigation.',
    icon: Users,
    category: 'Students',
    sidebarInjections: [],
  },

  // ── Relatives ────────────────────────────────────────────────────────────
  {
    id: 'relatives',
    name: 'Relatives',
    description:
      'Adds a "Relatives" tab to the Student Info page showing siblings (students sharing the same parent) and linked parents/guardians. Useful for family-aware counseling and sibling discount verification.',
    icon: Users,
    category: 'Students',
    sidebarInjections: [],
  },

  // ── Templates ────────────────────────────────────────────────────────────
  {
    id: 'letter_templates',
    name: 'Templates',
    description:
      'Save and reuse letter content as named templates on the Print Letters page. Admins can add, update, and delete campus-specific templates from a dropdown.',
    icon: LayoutTemplate,
    category: 'Communication',
    settingsHref: '/admin/students/print-letters',
    sidebarInjections: [],
  },

  // ── TinyMCE Formula ──────────────────────────────────────────────────────
  {
    id: 'formula_editor',
    name: 'TinyMCE Formula',
    description:
      'Adds an "fx" button to the rich-text editor toolbar. Opens a LaTeX formula editor with symbol shortcuts (Greek letters, calculus, matrices, arrows) and a live preview. Renders the formula as an inline image.',
    icon: Sigma,
    category: 'Editor',
    sidebarInjections: [],
  },

  // ── TinyMCE Record Audio Video ───────────────────────────────────────────
  {
    id: 'record_audio_video',
    name: 'TinyMCE Record Audio Video',
    description:
      'Adds microphone and camera buttons to the rich-text editor toolbar. Records up to 2-minute audio or video annotations via the browser MediaRecorder API, uploads to campus-specific storage, and embeds playable players in the document.',
    icon: Mic,
    category: 'Editor',
    sidebarInjections: [],
  },

  // ── Absent for the Day on First Absence ─────────────────────────────────
  {
    id: 'absent_on_first_absence',
    name: 'Absent for the Day on First Absence',
    description:
      'When any single period attendance record is marked absent, the student is automatically marked absent for the entire day. Eliminates the need to manually update daily attendance after a period absence is logged.',
    icon: UserX,
    category: 'Attendance',
    settingsHref: '/admin/settings/automatic-attendance',
    sidebarInjections: [],
  },

  // ── Append Custom Field to Grade Level ──────────────────────────────────
  {
    id: 'student_list_append',
    name: 'Append Custom Field to Grade Level',
    description:
      'Appends a custom student field value next to the grade level column in the student listing. Choose any profile, system, or custom field to display alongside the grade — e.g. "Grade 9 / john.doe". Supports a second field and a configurable separator.',
    icon: Tag,
    category: 'Students',
    settingsHref: '/admin/settings/student-list-display',
    sidebarInjections: [],
  },

  // ── Assignment Max Points ────────────────────────────────────────────────
  {
    id: 'assignment_max_points',
    name: 'Assignment Max Points',
    description:
      'Enforces a campus-wide maximum points cap on gradebook assignments. When creating or mass-creating assignments, point values above the configured cap are rejected with a clear error. Keeps grading scales consistent across all classes.',
    icon: Hash,
    category: 'Grades',
    settingsHref: '/admin/settings/assignment-max-points',
    sidebarInjections: [],
  },

  // ── Convert Names To Titlecase ───────────────────────────────────────────
  {
    id: 'convert_names_titlecase',
    name: 'Convert Names To Titlecase',
    description:
      'One-time utility to standardise student and staff name fields (First Name, Last Name, Father Name, Grandfather Name) to titlecase for this campus. Only profiles whose names differ from titlecase are updated. Safe to run multiple times.',
    icon: Type,
    category: 'Students',
    settingsHref: '/admin/settings/convert-names-titlecase',
    sidebarInjections: [],
  },

  // ── Force Password Change ─────────────────────────────────────────────────
  {
    id: 'force_password_change',
    name: 'Force Password Change',
    description:
      'Require all users in this campus to set a new password on their next login. Useful after a security incident or onboarding. Users are redirected to a mandatory change-password screen before accessing any page. Admins can also reset the flag at any time.',
    icon: ShieldAlert,
    category: 'Security',
    settingsHref: '/admin/settings/force-password-change',
    sidebarInjections: [],
  },

  // ── Tutor Report Card Comments ───────────────────────────────────────────
  {
    id: 'tutor_report_card_comments',
    name: 'Tutor Report Card Comments',
    description:
      'Allows homeroom/tutor teachers to add a global comment per student per marking period. The comment appears on the student\'s report card PDF alongside individual subject grades. Comments are campus-scoped and stored per academic year and marking period.',
    icon: MessageSquare,
    category: 'Grades',
    settingsHref: '/admin/grades/report-cards',
    sidebarInjections: [],
  },

  // ── PDF Two Copies Landscape ─────────────────────────────────────────────
  {
    id: 'report_cards_pdf_two_copies_landscape',
    name: 'Report Cards PDF Two Copies Landscape',
    description:
      'Prints each student\'s report card twice side-by-side on a single A4 landscape page — one copy for the school file and one for the student. Toggle the "Two Copies — Landscape" option on the Report Cards print page to activate.',
    icon: Copy,
    category: 'Grades',
    settingsHref: '/admin/grades/report-cards',
    sidebarInjections: [],
  },

  // ── Grading Scale Generation ─────────────────────────────────────────────
  {
    id: 'grading_scale_generation',
    name: 'Grading Scale Generation',
    description:
      'Auto-generates numeric grade entries for a grading scale from a min–max range with a configurable step (1, 0.5, 0.25, 0.1, 0.05, 0.01). Replaces all existing entries in the selected scale. Supports comma or dot as the decimal separator.',
    icon: Zap,
    category: 'Grades',
    settingsHref: '/admin/grades/grading-scales',
    sidebarInjections: [],
  },

  // ── Future plugins go here ────────────────────────────────────────────────
  // Example template:
  // {
  //   id: 'food_service',
  //   name: 'Food Service',
  //   description: 'Track student meal plans and cafeteria transactions.',
  //   icon: ShoppingBag,
  //   category: 'Operations',
  //   sidebarInjections: [],
  // },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Group plugins by category for the configuration page */
export function getPluginsByCategory(): Record<string, PluginDefinition[]> {
  return PLUGIN_REGISTRY.reduce<Record<string, PluginDefinition[]>>((acc, plugin) => {
    if (!acc[plugin.category]) acc[plugin.category] = []
    acc[plugin.category].push(plugin)
    return acc
  }, {})
}

/** Look up a single plugin definition by id */
export function getPlugin(id: string): PluginDefinition | undefined {
  return PLUGIN_REGISTRY.find((p) => p.id === id)
}
