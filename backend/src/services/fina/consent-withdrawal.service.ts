import { supabase } from '../../config/supabase'
import { registerFinaJobHandler } from './jobs-runner.service'
import { computeScopeFromTags, ConsentLevel } from './consent-engine.service'
import { REQUIRED_SCOPE_BY_AUDIENCE } from './consent-gate.service'
import { notifyConsentWithdrawnToPrincipal } from './notifications.service'

/**
 * Handler for the 'reprocess_student_archive' fina_jobs kind — spec §8.4's
 * withdrawal-reprocessing chain, enqueued by consent.service.ts::
 * withdrawConsent() at the moment of withdrawal (the cache invalidation and
 * audit log entry already happened synchronously there; this job is
 * specifically the archive-wide reprocessing). Highest job priority (1),
 * so it's never stuck behind routine album/variant-generation work — the
 * spec's own 24h SLA is trivially met by this build's ~10s poll interval.
 *
 * fina_face_embeddings hard-delete (spec §8.4) is N/A in this build — no
 * embeddings table exists yet (Phase 1's deferred-auto-detection deviation).
 *
 * Also reused by the Phase 6 student-deletion hook (student.service.ts::
 * deleteStudent()): fina_face_tags.student_id is ON DELETE SET NULL, so by
 * the time this job could otherwise look up "media tagged with this
 * student" the row is already gone and student_id is already null on every
 * affected tag — the lookup below would silently find nothing. The caller
 * in that case pre-fetches the affected media_ids BEFORE the delete and
 * passes them directly via payload.mediaIds, skipping the by-studentId
 * lookup entirely. This has no security implication either way — the tag
 * going null already forces DENY_ALL the instant anyone next requests that
 * media (consent-engine.service.ts::effectiveScope() is never cached beyond
 * a single request) — this job's actual job here is just keeping
 * fina_media's cached min_consent_level/has_unconsented columns and any
 * already-published post's state in sync, not gating access itself.
 */
export async function handleReprocessStudentArchive(payload: Record<string, unknown>): Promise<void> {
  const studentId = payload.studentId as string | undefined
  const explicitMediaIds = payload.mediaIds as string[] | undefined
  if (!studentId && !explicitMediaIds) throw new Error('reprocess_student_archive job payload missing studentId/mediaIds')

  let mediaIds: string[]
  if (explicitMediaIds) {
    mediaIds = [...new Set(explicitMediaIds)]
  } else {
    const { data: tagRows, error: tagError } = await supabase.from('fina_face_tags').select('media_id').eq('student_id', studentId as string)
    if (tagError) throw new Error(`Failed to load media tagged with this student: ${tagError.message}`)
    mediaIds = [...new Set((tagRows || []).map((t) => t.media_id as string))]
  }
  let schoolId: string | null = null

  for (const mediaId of mediaIds) {
    const { data: media } = await supabase.from('fina_media').select('id, school_id, processing_state').eq('id', mediaId).maybeSingle()
    if (!media) continue
    schoolId = schoolId || media.school_id
    // Media never confirmed past tagging never carried a public scope to
    // begin with — nothing to recompute or un-publish.
    if (media.processing_state !== 'ready' && media.processing_state !== 'pending_variants') continue

    const { data: allTags } = await supabase.from('fina_face_tags').select('student_id').eq('media_id', mediaId)
    const rows = allTags || []
    const hasUnresolvedFace = rows.some((t) => t.student_id === null)
    const taggedStudentIds = [...new Set(rows.map((t) => t.student_id).filter(Boolean) as string[])]
    const newScope = await computeScopeFromTags(taggedStudentIds, hasUnresolvedFace)

    await supabase
      .from('fina_media')
      .update({ min_consent_level: newScope, has_unconsented: newScope === ConsentLevel.DENY_ALL })
      .eq('id', mediaId)

    const { data: postMediaRows } = await supabase.from('fina_post_media').select('post_id').eq('media_id', mediaId)
    for (const pm of postMediaRows || []) {
      const { data: post } = await supabase.from('fina_posts').select('id, audience_type, state').eq('id', pm.post_id).maybeSingle()
      if (!post || post.state !== 'published') continue
      const requiredScope = REQUIRED_SCOPE_BY_AUDIENCE[post.audience_type] ?? ConsentLevel.SCHOOL_SCOPE
      if (newScope < requiredScope) {
        // Atomic guard — never flips a post that's already moved on (e.g.
        // an admin soft-deleted it in the meantime).
        await supabase.from('fina_posts').update({ state: 'restricted' }).eq('id', post.id).eq('state', 'published')
      }
    }
  }

  if (schoolId) {
    await notifyConsentWithdrawnToPrincipal(schoolId)
  }
}

registerFinaJobHandler('reprocess_student_archive', handleReprocessStudentArchive)
