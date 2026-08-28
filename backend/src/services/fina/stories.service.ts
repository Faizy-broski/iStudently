import { supabase } from '../../config/supabase'
import { CallerContext } from './types'
import { ConsentLevel, effectiveScope } from './consent-engine.service'
import { logAuditFromCaller } from './audit-logger.service'
import { enqueueFinaJob } from '../../utils/fina-jobs'
import { registerFinaJobHandler } from './jobs-runner.service'

/**
 * Stories (spec §7.5, §16.2's stories bar, §19: visible 24h then archived
 * for a year). Deliberately the lowest-ceremony content type in the module
 * — no review/approval queue, matching the spec's own framing of stories as
 * the least safety-critical, most "impressive layer" feature (§26: "do not
 * start with stories and live streaming"). The one rule that is NEVER
 * relaxed even here: the consent hard-stop. A story is inherently
 * school-wide visibility (there's no audience picker for something this
 * ephemeral), so its media must already clear SCHOOL_SCOPE.
 */

// super_admin excluded — spec §12: SYSADMIN has no Publish access.
const STAFF_ROLES = ['teacher', 'admin', 'media_officer']
const STORY_TTL_MS = 24 * 60 * 60 * 1000

export async function createStory(caller: CallerContext, mediaId: string) {
  if (!STAFF_ROLES.includes(caller.role)) throw new Error('Access denied: staff access required')

  const { data: media, error: mediaError } = await supabase.from('fina_media').select('id, school_id, processing_state').eq('id', mediaId).maybeSingle()
  if (mediaError || !media) throw new Error('Media not found')
  if (media.school_id !== caller.schoolId) throw new Error('Access denied: media belongs to a different school')
  if (media.processing_state !== 'ready') throw new Error('This media is still processing')

  const scope = await effectiveScope(mediaId)
  if (scope < ConsentLevel.SCHOOL_SCOPE) {
    throw new Error('This content cannot be published: it includes a student outside the permitted scope. Please contact administration.')
  }

  const expiresAt = new Date(Date.now() + STORY_TTL_MS).toISOString()
  const { data: created, error } = await supabase
    .from('fina_stories')
    .insert({ school_id: media.school_id, media_id: mediaId, author_id: caller.profileId, expires_at: expiresAt })
    .select()
    .single()
  if (error || !created) throw new Error(`Failed to create story: ${error?.message}`)

  await enqueueFinaJob('expire_stories', { storyId: created.id }, 5, expiresAt)
  await logAuditFromCaller(caller, 'story.created', { subjectType: 'story', subjectId: created.id })

  return created
}

/** Active (unarchived, unexpired) stories at the caller's school, grouped
 * implicitly by author for the frontend's stories bar. Same audience logic
 * as the wall's 'school' case — every same-school viewer sees every active
 * story, since a story's own consent scope was already required to be
 * SCHOOL_SCOPE at creation. */
export async function listActiveStories(caller: CallerContext) {
  if (caller.role === 'super_admin') throw new Error('Access denied') // spec §12: SYSADMIN has zero content access
  const { data, error } = await supabase
    .from('fina_stories')
    .select('id, media_id, author_id, created_at, expires_at, author:profiles(first_name, last_name)')
    .eq('school_id', caller.schoolId)
    .is('archived_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Failed to load stories: ${error.message}`)
  return data || []
}

async function handleExpireStory(payload: Record<string, unknown>): Promise<void> {
  const storyId = payload.storyId as string | undefined
  if (!storyId) throw new Error('expire_stories job payload missing storyId')
  const { error } = await supabase.from('fina_stories').update({ archived_at: new Date().toISOString() }).eq('id', storyId).is('archived_at', null)
  if (error) throw new Error(`Failed to archive story: ${error.message}`)
}

registerFinaJobHandler('expire_stories', handleExpireStory)
