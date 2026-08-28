import { supabase } from '../../config/supabase'

/**
 * The Al-Fina' module's consent-level scale (spec §7.2). DENY_ALL=0 is the
 * most restrictive, SPECIAL_GRANT=4 the widest. INNER_CIRCLE=1 is the safe
 * default applied whenever no active consent record exists for a student.
 */
export enum ConsentLevel {
  DENY_ALL = 0,
  INNER_CIRCLE = 1,
  CLASS_SCOPE = 2,
  SCHOOL_SCOPE = 3,
  SPECIAL_GRANT = 4,
}

const CACHE_TTL_MS = 300_000 // 5 minutes, matches the spec's Cache::remember(...,300,...)
const levelCache = new Map<string, { level: ConsentLevel; expiresAt: number }>()

/** Called by the withdrawal flow and by createConsent/supersede — must be
 * invoked synchronously (not queued) so a widened/narrowed consent is never
 * served stale from cache, even for the few seconds until TTL would expire. */
export function invalidateConsentCache(studentId: string): void {
  levelCache.delete(studentId)
}

/**
 * The single source of truth for "what consent level currently applies to
 * this student". Missing/expired/no-row data ALWAYS returns INNER_CIRCLE.
 * Never returns SCHOOL_SCOPE by default, never throws — per the spec's own
 * explicit instruction, missing data must never widen access.
 *
 * When a student has more than one currently-active consent-authority
 * guardian (e.g. joint 'both' guardianship under parent_student_links), the
 * MOST RESTRICTIVE (minimum) level among their respective active rows wins.
 * This deliberately corrects the source spec's own PHP pseudocode (which
 * just takes the single most-recently-signed active row regardless of which
 * guardian signed it) so the engine actually satisfies the spec's own stated
 * edge case: "Two guardians disagree -> is_consent_guardian wins; on a tie,
 * the more restrictive wins." Only rows from consent.service's
 * createConsent — which requires is_consent_guardian=true on the caller's
 * parent_student_links row before it will insert — ever reach 'active'
 * status, so every row this function sees already carries authority.
 */
export async function activeLevel(studentId: string): Promise<ConsentLevel> {
  const cached = levelCache.get(studentId)
  if (cached && cached.expiresAt > Date.now()) return cached.level

  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('fina_consents')
    .select('level, valid_until')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .lte('valid_from', nowIso)

  if (error) {
    console.error('Error loading fina_consents for activeLevel:', error)
    return ConsentLevel.INNER_CIRCLE
  }

  const rows = (data || []).filter((r) => !r.valid_until || r.valid_until >= nowIso)
  const level = rows.length === 0
    ? ConsentLevel.INNER_CIRCLE
    : (Math.min(...rows.map((r) => r.level)) as ConsentLevel)

  levelCache.set(studentId, { level, expiresAt: Date.now() + CACHE_TTL_MS })
  return level
}

/**
 * Lowest active consent level among every student tagged in a media row —
 * spec §8.1. Depends on fina_media/fina_face_tags, which land in Phase 1;
 * this function is wired up there but lives here so consent-gate.service.ts
 * (Phase 0) can call a stable API from day one.
 *
 * A single untagged/unresolved face-region, or zero tags recorded but not
 * yet explicitly marked "no identifiable students", is treated as DENY_ALL —
 * the manual-tagging equivalent of the spec's "a single unidentified face
 * implies maximum restriction" rule, since this build defers automated face
 * detection (see the plan's Phase 1 deviation note).
 */
/**
 * The pure scope-from-tags computation, factored out so both effectiveScope()
 * (below — the gate-facing version, which additionally refuses to serve
 * anything not yet confirmed 'ready'/'pending_variants') and
 * media-pipeline.service.ts::confirmTagging() (which must compute this
 * BEFORE that state transition happens, to decide what the transition
 * itself should record) share one implementation. Never call this directly
 * from a viewing/serving code path — use effectiveScope() there.
 */
export async function computeScopeFromTags(
  taggedStudentIds: string[],
  hasUnresolvedFace: boolean
): Promise<ConsentLevel> {
  if (hasUnresolvedFace) return ConsentLevel.DENY_ALL
  if (taggedStudentIds.length === 0) {
    // No faces at all is a distinct, explicit staff attestation ("no
    // identifiable students in this photo") — media-pipeline.service.ts
    // only allows confirm-tagging to proceed with zero tags when that flag
    // was explicitly set, so reaching here with zero tags means a generic
    // photo, safe at SCHOOL_SCOPE per the spec.
    return ConsentLevel.SCHOOL_SCOPE
  }
  const levels = await Promise.all(taggedStudentIds.map((id) => activeLevel(id)))
  return Math.min(...levels) as ConsentLevel
}

export async function effectiveScope(mediaId: string): Promise<ConsentLevel> {
  const { data: media, error: mediaError } = await supabase
    .from('fina_media')
    .select('processing_state')
    .eq('id', mediaId)
    .maybeSingle()

  if (mediaError || !media) {
    console.error('Error loading fina_media for effectiveScope:', mediaError)
    return ConsentLevel.DENY_ALL
  }

  // Tagging isn't confirmed yet -> treat as maximally restricted, never serve
  // a photo whose subjects haven't been affirmatively reviewed by staff.
  if (media.processing_state !== 'ready' && media.processing_state !== 'pending_variants') {
    return ConsentLevel.DENY_ALL
  }

  const { data: tags, error: tagsError } = await supabase
    .from('fina_face_tags')
    .select('student_id')
    .eq('media_id', mediaId)

  if (tagsError) {
    console.error('Error loading fina_face_tags for effectiveScope:', tagsError)
    return ConsentLevel.DENY_ALL
  }

  const tagRows = tags || []
  const hasUnresolvedFace = tagRows.some((t) => t.student_id === null)
  const studentIds = [...new Set(tagRows.map((t) => t.student_id).filter(Boolean) as string[])]
  return computeScopeFromTags(studentIds, hasUnresolvedFace)
}
