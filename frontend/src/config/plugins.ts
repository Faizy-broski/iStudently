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
