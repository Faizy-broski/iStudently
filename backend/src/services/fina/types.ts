/**
 * Shared types for the Al-Fina' module's service layer. Mirrors the
 * CallerContext { profileId, role, schoolId } shape already established by
 * the Educational Inspection module this session (see
 * backend/src/services/inspection-evaluation.service.ts and friends), kept
 * as its own copy here rather than importing from that unrelated module.
 */
export interface CallerContext {
  profileId: string
  role: string
  schoolId: string
}
