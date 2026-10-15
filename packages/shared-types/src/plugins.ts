// Plugins an admin can switch on per campus (Settings > Plugins). Generated from
// frontend/src/config/plugins.ts PLUGIN_REGISTRY (ids, categories and settings links only;
// names and descriptions come from the setup.plugins_page messages).

export interface PluginInfo {
  id: string
  category: string
  /** Web page for the plugin's settings (shown when the plugin is active). */
  settingsHref?: string
}

export const PLUGINS: PluginInfo[] = [
  { id: 'grievance_portal', category: 'Communication', settingsHref: '/admin/grievances/settings' },
  { id: 'hifzi', category: 'Academics', settingsHref: '/admin/hifzi/settings' },
  { id: 'miqat', category: 'Attendance', settingsHref: '/admin/miqat/settings' },
  { id: 'weather_alerts', category: 'Safety', settingsHref: '/admin/weather-alerts/settings' },
  { id: 'hadith_forty', category: 'Academics', settingsHref: '/admin/resources/hadith-forty/class' },
  { id: 'qirtasi', category: 'Resources', settingsHref: '/admin/qirtasi/curriculum' },
  { id: 'online_classes', category: 'Classes', settingsHref: '/admin/jitsi-meet/configuration' },
  { id: 'automatic_attendance', category: 'Attendance', settingsHref: '/admin/settings/automatic-attendance' },
  { id: 'calendar_schedule_view', category: 'Attendance', settingsHref: '/admin/events' },
  { id: 'discipline_score', category: 'Discipline', settingsHref: '/admin/discipline/referral-form' },
  { id: 'icalendar', category: 'Calendar', settingsHref: '/admin/events' },
  { id: 'email_reminders', category: 'Email', settingsHref: '/admin/settings/email-reminders' },
  { id: 'email_smtp', category: 'Email', settingsHref: '/admin/settings/email-smtp' },
  { id: 'pdf_header_footer', category: 'Reports', settingsHref: '/admin/settings/pdf-header-footer' },
  { id: 'public_pages', category: 'Communication', settingsHref: '/admin/settings/public-pages' },
  { id: 'previous_next_student', category: 'Students' },
  { id: 'relatives', category: 'Students' },
  { id: 'letter_templates', category: 'Communication', settingsHref: '/admin/students/print-letters' },
  { id: 'formula_editor', category: 'Editor' },
  { id: 'record_audio_video', category: 'Editor' },
  { id: 'absent_on_first_absence', category: 'Attendance', settingsHref: '/admin/settings/automatic-attendance' },
  { id: 'student_list_append', category: 'Students', settingsHref: '/admin/settings/student-list-display' },
  { id: 'assignment_max_points', category: 'Grades', settingsHref: '/admin/settings/assignment-max-points' },
  { id: 'convert_names_titlecase', category: 'Students', settingsHref: '/admin/settings/convert-names-titlecase' },
  { id: 'force_password_change', category: 'Security', settingsHref: '/admin/settings/force-password-change' },
  { id: 'two_factor_auth', category: 'Security', settingsHref: '/admin/settings/two-factor-auth' },
  { id: 'tutor_report_card_comments', category: 'Grades', settingsHref: '/admin/grades/report-cards' },
  { id: 'report_cards_pdf_two_copies_landscape', category: 'Grades', settingsHref: '/admin/grades/report-cards' },
  { id: 'grading_scale_generation', category: 'Grades', settingsHref: '/admin/grades/grading-scales' },
  { id: 'google_social_login', category: 'Security', settingsHref: '/admin/settings/google-social-login' },
  { id: 'microsoft_social_login', category: 'Security', settingsHref: '/admin/settings/microsoft-social-login' },
  { id: 'custom_menu', category: 'Customisation', settingsHref: '/admin/settings/custom-menu' },
  { id: 'setup_assistant', category: 'Onboarding', settingsHref: '/admin/settings/setup-assistant' },
  { id: 'unsaved_changes_warning', category: 'User Experience' },
  { id: 'embedded_resources', category: 'Resources', settingsHref: '/admin/resources/embedded' },
  { id: 'vlaby', category: 'Resources', settingsHref: '/admin/resources/virtual-labs' },
  { id: 'periodic_table', category: 'Resources', settingsHref: '/admin/resources/jperiod' },
  { id: 'arabic_fluency', category: 'Resources', settingsHref: '/admin/resources/arabic-fluency' },
  { id: 'physics_virtual_labs', category: 'Resources', settingsHref: '/admin/resources/physics-virtual-labs' },
  { id: 'chemistry_virtual_labs', category: 'Resources', settingsHref: '/admin/resources/chemistry-virtual-labs' },
  { id: 'marking_period_groups', category: 'Grades', settingsHref: '/admin/settings/marking-period-groups' },
  { id: 'human_atlas', category: 'Resources', settingsHref: '/admin/resources/human-atlas' },
  { id: 'vault', category: 'Security', settingsHref: '/admin/vault' },
]
