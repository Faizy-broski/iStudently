import crypto from 'crypto'
import ical, { ICalCalendarMethod } from 'ical-generator'
import { supabase } from '../config/supabase'

// ============================================================================
// Types
// ============================================================================

export type ICalType = 'events' | 'schedule'

export interface ICalLinkResult {
  url: string
  token: string
}

// ============================================================================
// Stateless token helpers
// Tokens are HMAC-signed with a master key derived from env vars.
// No DB reads/writes are required for sign or verify — completely stateless.
// ============================================================================

function getMasterKey(): string {
  // Prefer a dedicated secret; fall back to the service-role key which is
  // already a stable, server-only secret never exposed to clients.
  const key = process.env.ICAL_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('No ICAL signing key available')
  return key
}

function buildPayload(schoolId: string, campusId: string | null, type: ICalType): string {
  return Buffer.from(JSON.stringify({ schoolId, campusId, type })).toString('base64url')
}

function signPayload(payload: string): string {
  return crypto.createHmac('sha256', getMasterKey()).update(payload).digest('base64url')
}

export async function generateToken(params: {
  schoolId: string
  campusId: string | null
  type: ICalType
}): Promise<string> {
  const { schoolId, campusId, type } = params
  const payload = buildPayload(schoolId, campusId, type)
  const sig = signPayload(payload)
  return `${payload}.${sig}`
}

export async function verifyToken(token: string): Promise<{
  schoolId: string
  campusId: string | null
  type: ICalType
} | null> {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payload, sig] = parts

  let parsed: { schoolId: string; campusId: string | null; type: ICalType }
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }

  const { schoolId, campusId, type } = parsed
  if (!schoolId || !type) return null

  const expected = signPayload(payload)
  // timingSafeEqual requires equal-length buffers
  const sigBuf = Buffer.from(sig)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length) return null
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null

  return { schoolId, campusId, type }
}

// ============================================================================
// Plugin check
// ============================================================================

async function checkPluginActive(schoolId: string, campusId: string | null): Promise<boolean> {
  if (campusId) {
    const { data } = await supabase
      .from('school_settings')
      .select('active_plugins')
      .eq('school_id', schoolId)
      .eq('campus_id', campusId)
      .maybeSingle()
    if (data?.active_plugins?.icalendar) return true
  }
  const { data } = await supabase
    .from('school_settings')
    .select('active_plugins')
    .eq('school_id', schoolId)
    .is('campus_id', null)
    .maybeSingle()
  return !!data?.active_plugins?.icalendar
}

// ============================================================================
// Events calendar
// ============================================================================

async function generateEventsCalendar(
  schoolId: string,
  campusId: string | null,
  schoolName: string
): Promise<string> {
  let query = supabase
    .from('school_events')
    .select('id, title, description, start_at, end_at, is_all_day, category, color_code')
    .eq('school_id', schoolId)
    .order('start_at', { ascending: true })

  if (campusId) {
    query = (query as any).or(`campus_id.eq.${campusId},campus_id.is.null`)
  }

  const { data: events, error } = await query
  if (error) throw error

  const cal = ical({ name: `${schoolName} — Events` })
  cal.method(ICalCalendarMethod.PUBLISH)

  for (const ev of events || []) {
    const start = new Date(ev.start_at)
    const end = ev.end_at ? new Date(ev.end_at) : new Date(start.getTime() + 60 * 60 * 1000)
    cal.createEvent({
      id: ev.id,
      summary: ev.title,
      description: ev.description || undefined,
      start,
      end,
      allDay: ev.is_all_day ?? false,
    })
  }

  return cal.toString()
}

// ============================================================================
// Schedule calendar (timetable mapped to school days)
// ============================================================================

async function generateScheduleCalendar(
  schoolId: string,
  campusId: string | null,
  schoolName: string
): Promise<string> {
  // Fetch school days for next 3 months from attendance_calendar
  const today = new Date()
  const startDate = today.toISOString().slice(0, 10)
  const endDate = new Date(today.getFullYear(), today.getMonth() + 3, 0)
    .toISOString()
    .slice(0, 10)

  const calQuery = supabase
    .from('attendance_calendar')
    .select('school_date, block')
    .gte('school_date', startDate)
    .lte('school_date', endDate)
    .eq('is_school_day', true)
    .order('school_date')

  // Find the relevant attendance calendar for this school/campus
  const { data: schoolDays } = await (campusId
    ? (calQuery as any).eq('school_id', campusId)
    : (calQuery as any).eq('school_id', schoolId))

  // Fetch timetable entries
  const schoolIds = campusId ? [schoolId, campusId] : [schoolId]
  let ttQuery = supabase
    .from('timetable_entries')
    .select(`
      id, day_of_week, room_number, section_id,
      section:sections(name, grade_level:grade_levels(name)),
      subject:subjects(name),
      teacher:staff!teacher_id(profile:profiles!staff_profile_id_fkey(first_name, last_name)),
      period:periods(period_number, period_name, start_time, end_time, sort_order)
    `)
    .in('school_id', schoolIds)
    .eq('is_active', true)

  if (campusId) {
    ttQuery = (ttQuery as any).or(`campus_id.eq.${campusId},campus_id.is.null`)
  }

  const { data: entries } = await ttQuery

  if (!entries?.length || !schoolDays?.length) {
    return ical({ name: `${schoolName} — Schedule` }).toString()
  }

  // Index entries by day_of_week (0=Mon … 6=Sun)
  const byDow: Record<number, typeof entries> = {}
  for (const e of entries) {
    const d = e.day_of_week as number
    if (!byDow[d]) byDow[d] = []
    byDow[d].push(e)
  }

  // JS Date.getDay(): 0=Sun → our 6, 1=Mon → 0, ...
  const jsDowToOur = (d: number) => (d === 0 ? 6 : d - 1)

  const cal = ical({ name: `${schoolName} — Schedule` })
  cal.method(ICalCalendarMethod.PUBLISH)

  for (const day of schoolDays) {
    const date = new Date(`${day.school_date}T00:00:00`)
    const ourDow = jsDowToOur(date.getDay())
    const dayEntries = byDow[ourDow] || []

    for (const entry of dayEntries) {
      const period = (entry as any).period
      if (!period?.start_time || !period?.end_time) continue

      const [sh, sm] = period.start_time.split(':').map(Number)
      const [eh, em] = period.end_time.split(':').map(Number)
      const start = new Date(date)
      start.setHours(sh, sm, 0)
      const end = new Date(date)
      end.setHours(eh, em, 0)

      const subjectName = (entry as any).subject?.name || 'Class'
      const sectionName = (entry as any).section?.name || ''
      const gradeName = (entry as any).section?.grade_level?.name || ''
      const teacherProfile = (entry as any).teacher?.profile
      const teacherName = teacherProfile
        ? `${teacherProfile.first_name || ''} ${teacherProfile.last_name || ''}`.trim()
        : 'Unassigned'
      const room = (entry as any).room_number || ''

      cal.createEvent({
        id: `${entry.id}-${day.school_date}`,
        summary: subjectName + (sectionName ? ` (${sectionName})` : ''),
        description: [
          gradeName && `Grade: ${gradeName}`,
          `Teacher: ${teacherName}`,
          room && `Room: ${room}`,
        ]
          .filter(Boolean)
          .join('\n'),
        location: room || undefined,
        start,
        end,
      })
    }
  }

  return cal.toString()
}

// ============================================================================
// Public API
// ============================================================================

export async function getICalLink(params: {
  schoolId: string
  campusId: string | null
  type: ICalType
  baseUrl: string
}): Promise<ICalLinkResult> {
  const { schoolId, campusId, type, baseUrl } = params

  const pluginActive = await checkPluginActive(schoolId, campusId)
  if (!pluginActive) throw new Error('PLUGIN_INACTIVE')

  const token = await generateToken({ schoolId, campusId, type })
  const url = `${baseUrl}/api/ical/subscribe/${token}`
  return { url, token }
}

export async function streamICalendar(token: string): Promise<{ content: string; name: string }> {
  const parsed = await verifyToken(token)
  if (!parsed) throw new Error('INVALID_TOKEN')

  const { schoolId, campusId, type } = parsed

  // Fetch school name
  const { data: school } = await supabase
    .from('schools')
    .select('name')
    .eq('id', schoolId)
    .maybeSingle()
  const schoolName = school?.name || 'School'

  let content: string
  if (type === 'schedule') {
    content = await generateScheduleCalendar(schoolId, campusId, schoolName)
  } else {
    content = await generateEventsCalendar(schoolId, campusId, schoolName)
  }

  return { content, name: `${schoolName.replace(/\s+/g, '_')}_${type}.ics` }
}
