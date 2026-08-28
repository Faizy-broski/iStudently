import { supabase } from '../../config/supabase'
import { CallerContext } from './types'
import { logAuditFromCaller } from './audit-logger.service'
import { getViewerAudienceContext, matchesAudience, STAFF_VIEW_ROLES } from './wall.service'

/** Events (spec §7.5) — same audience_type/audience_ref shape as posts,
 * reusing wall.service.ts's audience-matching logic directly rather than a
 * parallel implementation that could drift out of sync with it. */

// super_admin excluded — spec §12: SYSADMIN has no Publish access.
const STAFF_ROLES = ['teacher', 'admin', 'media_officer']

export interface CreateEventInput {
  title: string
  body?: string
  startsAt: string
  location?: string
  audienceType?: 'school' | 'classes' | 'group' | 'students'
  audienceRef?: Record<string, unknown>
}

export async function createEvent(caller: CallerContext, input: CreateEventInput) {
  if (!STAFF_ROLES.includes(caller.role)) throw new Error('Access denied: staff access required')
  if (!input.title?.trim()) throw new Error('An event title is required')
  if (!input.startsAt) throw new Error('A start date/time is required')

  const { data: created, error } = await supabase
    .from('fina_events')
    .insert({
      school_id: caller.schoolId,
      title: input.title.trim(),
      body: input.body ?? null,
      starts_at: input.startsAt,
      location: input.location ?? null,
      audience_type: input.audienceType ?? 'school',
      audience_ref: input.audienceRef ?? {},
      created_by: caller.profileId,
    })
    .select()
    .single()
  if (error || !created) throw new Error(`Failed to create event: ${error?.message}`)

  await logAuditFromCaller(caller, 'event.created', { subjectType: 'event', subjectId: created.id })
  return created
}

export async function listEvents(caller: CallerContext) {
  if (caller.role === 'super_admin') throw new Error('Access denied') // spec §12: SYSADMIN has zero content access
  const isStaffViewer = STAFF_VIEW_ROLES.includes(caller.role)
  const { data, error } = await supabase
    .from('fina_events')
    .select('*, rsvps:fina_event_rsvps(user_id, answer)')
    .eq('school_id', caller.schoolId)
    .is('deleted_at', null)
    .order('starts_at', { ascending: true })
  if (error) throw new Error(`Failed to load events: ${error.message}`)

  const rows = data || []
  const visible = isStaffViewer ? rows : (await Promise.all(rows.map(async (e) => ((await matchesEventAudience(caller, e)) ? e : null)))).filter(Boolean)

  return visible.map((e: any) => ({
    ...e,
    myRsvp: (e.rsvps || []).find((r: any) => r.user_id === caller.profileId)?.answer ?? null,
    rsvpCounts: (e.rsvps || []).reduce((acc: Record<string, number>, r: any) => ({ ...acc, [r.answer]: (acc[r.answer] ?? 0) + 1 }), {}),
    rsvps: undefined,
  }))
}

async function matchesEventAudience(caller: CallerContext, event: { audience_type: string; audience_ref: any }): Promise<boolean> {
  const ctx = await getViewerAudienceContext(caller)
  return matchesAudience(event, ctx)
}

export async function rsvpEvent(caller: CallerContext, eventId: string, answer: 'yes' | 'no' | 'maybe') {
  if (caller.role === 'super_admin') throw new Error('Access denied') // spec §12: SYSADMIN has zero content access
  const { data: event } = await supabase.from('fina_events').select('id, school_id, audience_type, audience_ref').eq('id', eventId).maybeSingle()
  if (!event) throw new Error('Event not found')
  if (event.school_id !== caller.schoolId) throw new Error('Access denied')

  if (!STAFF_VIEW_ROLES.includes(caller.role)) {
    const isVisible = await matchesEventAudience(caller, event)
    if (!isVisible) throw new Error('Access denied')
  }

  const { data, error } = await supabase
    .from('fina_event_rsvps')
    .upsert({ event_id: eventId, user_id: caller.profileId, answer }, { onConflict: 'event_id,user_id' })
    .select()
    .single()
  if (error) throw new Error(`Failed to RSVP: ${error.message}`)
  return data
}
