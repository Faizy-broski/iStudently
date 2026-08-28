import { supabase } from '../../config/supabase'
import { CallerContext } from './types'
import { ConsentLevel, effectiveScope, computeScopeFromTags } from './consent-engine.service'
import { relationTo, sameClassAsAny } from './access-policy.service'
import { validateCampusAccess } from '../../utils/campus-validation'
import { logAudit } from './audit-logger.service'

// super_admin deliberately excluded — spec §12 gives SYSADMIN zero content
// access. Unlike every other role here, super_admin's own caller.schoolId is
// NOT restricted to their real school (resolveSchoolId() lets super_admin
// target any explicit school_id, by design, for other platform admin work) —
// so it's not safe to rely on a schoolId-mismatch check to keep them out;
// resolveMediaDecision() below denies super_admin explicitly and first.
const ADMIN_EQUIVALENT_ROLES = ['admin', 'media_officer']

/**
 * THE single source of truth for whether a caller may see a given media
 * asset, and in what form. No other module — no controller, no export, no
 * report, no maintenance script — may read fina_media.storage_key or
 * construct a media URL by any path that doesn't go through
 * resolveMediaDecision(). This is enforced structurally by keeping raw
 * fina_media/fina_face_tags reads confined to this file, consent-
 * engine.service.ts, and the ingest/tagging services that legitimately need
 * pre-gate access (media-pipeline.service.ts, added in Phase 1) — and in CI
 * by an ESLint rule forbidding `.from('fina_media')` anywhere else under
 * backend/src/{services,controllers}/fina/**.
 */
export type MediaDecision = { kind: 'full' } | { kind: 'blurred' } | { kind: 'denied' }

interface MediaRow {
  id: string
  school_id: string
  kind: 'image' | 'video'
  processing_state: string
}

async function loadMediaRow(mediaId: string): Promise<MediaRow | null> {
  const { data, error } = await supabase.from('fina_media').select('id, school_id, kind, processing_state').eq('id', mediaId).maybeSingle()
  if (error) {
    console.error('Error loading fina_media row:', error)
    return null
  }
  return data as MediaRow | null
}

interface TagRows {
  taggedStudentIds: string[]
  hasUnresolvedFace: boolean
}

/** One fetch, reused for BOTH the relation check (which students are
 * tagged) and the scope computation (which needs the same rows plus
 * whether any tag is unresolved) — avoids the two independent
 * fina_face_tags fetches this function and effectiveScope() used to do
 * separately for every single media view, the main cost behind this
 * endpoint feeling slow under real network latency. */
async function loadTagRows(mediaId: string): Promise<TagRows> {
  const { data, error } = await supabase.from('fina_face_tags').select('student_id').eq('media_id', mediaId)
  if (error) {
    console.error('Error loading fina_face_tags:', error)
    return { taggedStudentIds: [], hasUnresolvedFace: true } // fail toward maximum restriction, not zero tags (which would read as a "generic photo")
  }
  const rows = data || []
  return {
    taggedStudentIds: [...new Set(rows.map((t) => t.student_id).filter(Boolean) as string[])],
    hasUnresolvedFace: rows.some((t) => t.student_id === null),
  }
}

/**
 * Resolves what a caller may see of one media asset. Denials return a bare
 * 403 at the controller layer with no information about whether the
 * resource exists (the controller must not distinguish "denied" from "not
 * found" in its response body — see backend/src/controllers/fina/media.controller.ts).
 *
 * Mirrors the spec's ConsentGate.resolve() match arms exactly (§8.2),
 * translated to plain sequential checks:
 *   0. super_admin -> denied, always (spec §12: SYSADMIN has zero content access)
 *   1. admin-equivalent (admin/media_officer) -> full, always
 *   2. effectiveScope is DENY_ALL -> blurred, even for the tagged student's
 *      own guardian (DENY_ALL means the guardian themselves chose "never
 *      visible" — a pre-generated blurred variant is safe to serve to
 *      anyone since it can no longer identify the student). For VIDEO,
 *      this downgrades to denied instead — this build generates no blurred
 *      rendition for video (see media-variants.service.ts's header), so
 *      there is no safe file to serve; a stricter outcome than images get,
 *      never a weaker one.
 *   3. caller is guardian_of or teacher_of a tagged student -> full
 *   4. scope >= CLASS_SCOPE and caller has a child in the same section as a
 *      tagged student -> full
 *   5. scope >= SCHOOL_SCOPE and caller is in the same school -> full
 *   6. otherwise -> denied
 */
export async function resolveMediaDecision(caller: CallerContext, mediaId: string): Promise<MediaDecision> {
  if (caller.role === 'super_admin') return { kind: 'denied' } // spec §12: SYSADMIN has zero content access

  const media = await loadMediaRow(mediaId)
  if (!media) return { kind: 'denied' }

  if (caller.schoolId !== media.school_id) {
    const crossSchoolOk = await validateCampusAccess(caller.schoolId, media.school_id)
    if (!crossSchoolOk) return { kind: 'denied' }
  }

  // Fast path: admin-equivalent roles are always 'full' and need no tag
  // data at all — skips the fina_face_tags round trip entirely for what is
  // the most common caller in staff-facing screens (the composer's own
  // "ready media" grid, moderation queues, etc).
  if (ADMIN_EQUIVALENT_ROLES.includes(caller.role)) return { kind: 'full' }

  const { taggedStudentIds, hasUnresolvedFace } = await loadTagRows(mediaId)
  const relation = await relationTo(caller, taggedStudentIds)

  // Not ready/pending_variants yet -> maximally restricted, same rule
  // effectiveScope() enforces for any other caller of consent-engine.service.ts.
  const scope =
    media.processing_state !== 'ready' && media.processing_state !== 'pending_variants'
      ? ConsentLevel.DENY_ALL
      : await computeScopeFromTags(taggedStudentIds, hasUnresolvedFace)

  if (scope === ConsentLevel.DENY_ALL) {
    return media.kind === 'video' ? { kind: 'denied' } : { kind: 'blurred' }
  }

  if (relation === 'guardian_of' || relation === 'teacher_of' || relation === 'student_self') return { kind: 'full' }

  if (scope >= ConsentLevel.CLASS_SCOPE && (await sameClassAsAny(caller, taggedStudentIds))) return { kind: 'full' }

  if (scope >= ConsentLevel.SCHOOL_SCOPE && caller.schoolId === media.school_id) return { kind: 'full' }

  return { kind: 'denied' }
}

/** The consent level a post's own stated audience implies every attached
 * media asset must clear. 'group' (Phase 4, not yet modeled) is treated as
 * CLASS_SCOPE for now — a reasonable stand-in until real group membership
 * exists, and never wider than what 'classes' already requires. */
export const REQUIRED_SCOPE_BY_AUDIENCE: Record<string, ConsentLevel> = {
  school: ConsentLevel.SCHOOL_SCOPE,
  classes: ConsentLevel.CLASS_SCOPE,
  group: ConsentLevel.CLASS_SCOPE,
  students: ConsentLevel.INNER_CIRCLE,
}

/**
 * The publish-time hard stop — spec §8.3, "a hard stop, not a warning".
 * Checked once at submit (auto-filter stage, early feedback to the author)
 * AND again immediately before the final approve-to-published transition
 * (moderation.service.ts::approvePost) — a consent could change between
 * submission and final approval (e.g. a guardian withdraws consent mid-
 * review), so the check that actually gates publishing must be the one run
 * at the moment of publishing, not just trusted from submission time.
 *
 * Never names the blocking student in the thrown message — naming them is
 * itself a privacy disclosure inside a privacy control (spec's own words).
 */
export async function assertPublishable(postId: string): Promise<void> {
  const { data: post, error: postError } = await supabase.from('fina_posts').select('id, school_id, audience_type').eq('id', postId).maybeSingle()
  if (postError || !post) throw new Error('Post not found')

  const requiredScope = REQUIRED_SCOPE_BY_AUDIENCE[post.audience_type] ?? ConsentLevel.SCHOOL_SCOPE

  const { data: postMedia, error: mediaError } = await supabase.from('fina_post_media').select('media_id').eq('post_id', postId)
  if (mediaError) throw new Error(`Failed to load post media: ${mediaError.message}`)

  for (const row of postMedia || []) {
    const scope = await effectiveScope(row.media_id)
    if (scope < requiredScope) {
      await logAudit({
        schoolId: post.school_id,
        action: 'media.blocked',
        subjectType: 'media',
        subjectId: row.media_id,
        meta: { postId },
      })
      throw new Error('This content cannot be published: it includes a student outside the permitted scope. Please contact administration.')
    }
  }
}
