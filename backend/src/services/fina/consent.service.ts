import crypto from 'crypto'
import { supabase } from '../../config/supabase'
import { CallerContext } from './types'
import { ConsentLevel, activeLevel, invalidateConsentCache } from './consent-engine.service'
import { getConsentGuardianStudentIds } from './access-policy.service'
import { logAuditFromCaller } from './audit-logger.service'
import { getConsentText, CURRENT_CONSENT_TEXT_VERSION } from '../../config/fina-consent-text'
import { enqueueFinaJob } from '../../utils/fina-jobs'

/** GET /fina/consents/text/current — the exact canonical text a guardian is
 * about to sign, fetched fresh rather than duplicated in frontend i18n, so
 * what's displayed can never drift from what createConsent() actually
 * hashes. */
export function getCurrentConsentText() {
  return { version: CURRENT_CONSENT_TEXT_VERSION, text: getConsentText(CURRENT_CONSENT_TEXT_VERSION) }
}

export interface Ward {
  studentId: string
  firstName: string | null
  lastName: string | null
  sectionName: string | null
  isConsentGuardian: boolean
  currentLevel: ConsentLevel
}

export interface CreateConsentInput {
  studentId: string
  level: ConsentLevel
  purpose?: string
  validUntil?: string
  consentTextVersion?: string
  ip?: string | null
  userAgent?: string | null
}

/** GET /fina/consents/my-wards — every student this guardian has an active
 * link to, with their current effective consent level. Feeds the Phase 1
 * consent screen (spec §16.3). */
export async function listMyWards(caller: CallerContext): Promise<Ward[]> {
  if (caller.role !== 'parent') throw new Error('Access denied: guardian access required')

  const { data: parent } = await supabase.from('parents').select('id').eq('profile_id', caller.profileId).maybeSingle()
  if (!parent) return []

  const { data: links, error: linksError } = await supabase
    .from('parent_student_links')
    .select('student_id, is_consent_guardian')
    .eq('parent_id', parent.id)
    .eq('is_active', true)

  if (linksError) throw new Error(`Failed to load wards: ${linksError.message}`)
  const linkRows = links || []
  if (linkRows.length === 0) return []

  const studentIds = linkRows.map((l) => l.student_id as string)
  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select('id, section_id, profile:profiles(first_name, last_name), section:sections(name)')
    .in('id', studentIds)

  if (studentsError) throw new Error(`Failed to load student details: ${studentsError.message}`)
  const studentById = new Map((students || []).map((s: any) => [s.id as string, s]))

  const wards: Ward[] = []
  for (const link of linkRows) {
    const studentId = link.student_id as string
    const student = studentById.get(studentId)
    const level = await activeLevel(studentId)
    wards.push({
      studentId,
      firstName: student?.profile?.first_name ?? null,
      lastName: student?.profile?.last_name ?? null,
      sectionName: student?.section?.name ?? null,
      isConsentGuardian: !!link.is_consent_guardian,
      currentLevel: level,
    })
  }
  return wards
}

/** POST /fina/consents — grant or change a consent level. Only the resolved
 * consent-authority guardian for the student may call this — never any other
 * role, including super_admin (spec §12: SYSADMIN has zero Consents access;
 * a prior "for support" bypass here was removed since it let the platform
 * vendor's own account grant/change consent on a guardian's behalf, which
 * the spec's ministry-submitted matrix explicitly forbids). Supersedes any
 * prior active row from THIS same guardian before inserting the new one — a
 * level change is always a new row, per the append-only design; the DB's
 * partial unique index (uq_fina_consent_active_per_guardian) is the backstop
 * if two requests race. */
export async function createConsent(caller: CallerContext, input: CreateConsentInput) {
  if (caller.role !== 'parent') {
    throw new Error('Access denied: guardian access required')
  }
  if (!Number.isInteger(input.level) || input.level < ConsentLevel.DENY_ALL || input.level > ConsentLevel.SPECIAL_GRANT) {
    throw new Error('Invalid consent level')
  }
  if (input.level === ConsentLevel.SPECIAL_GRANT && !input.purpose) {
    throw new Error('purpose is required for special-grant consent')
  }

  const authorizedIds = await getConsentGuardianStudentIds(caller.profileId)
  if (!authorizedIds.includes(input.studentId)) {
    throw new Error('Access denied: you are not the resolved consent guardian for this student')
  }

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, school_id')
    .eq('id', input.studentId)
    .maybeSingle()
  if (studentError || !student) throw new Error('Student not found')

  const version = input.consentTextVersion || CURRENT_CONSENT_TEXT_VERSION
  const text = getConsentText(version)
  if (!text) throw new Error('Unknown consent text version')
  const consentTextHash = crypto.createHash('sha256').update(text, 'utf8').digest('hex')

  const nowIso = new Date().toISOString()

  const { error: supersedeError } = await supabase
    .from('fina_consents')
    .update({ status: 'superseded' })
    .eq('student_id', input.studentId)
    .eq('guardian_profile_id', caller.profileId)
    .eq('status', 'active')
  if (supersedeError) throw new Error(`Failed to supersede prior consent: ${supersedeError.message}`)

  const { data: created, error: insertError } = await supabase
    .from('fina_consents')
    .insert({
      school_id: student.school_id,
      student_id: input.studentId,
      guardian_profile_id: caller.profileId,
      level: input.level,
      purpose: input.purpose ?? null,
      valid_from: nowIso,
      valid_until: input.level === ConsentLevel.SPECIAL_GRANT ? (input.validUntil ?? null) : null,
      consent_text_hash: consentTextHash,
      consent_text_version: version,
      signed_at: nowIso,
      signed_ip: input.ip ?? null,
      signed_user_agent: input.userAgent ?? null,
    })
    .select()
    .single()

  if (insertError) {
    if ((insertError as any).code === '23505') {
      throw new Error('A consent change is already in progress for this student — please retry')
    }
    throw new Error(`Failed to record consent: ${insertError.message}`)
  }

  invalidateConsentCache(input.studentId)
  await logAuditFromCaller(caller, 'consent.granted', {
    subjectType: 'student',
    subjectId: input.studentId,
    meta: { level: input.level, consentTextVersion: version },
  })

  return created
}

/** POST /fina/consents/:id/withdraw — narrows a student's consent to
 * DENY_ALL is NOT implied; withdrawal simply deactivates the current active
 * row (its replacement, if any, is the guardian's next createConsent call —
 * the spec's withdraw button on the consent screen actually calls
 * createConsent with level=0, this endpoint is for outright deactivating a
 * SPECIAL_GRANT or correcting an erroneous grant without immediately
 * re-granting a level). Applied instantly, zero friction, per spec §16.3. */
export async function withdrawConsent(caller: CallerContext, consentId: string) {
  const { data: consent, error: loadError } = await supabase
    .from('fina_consents')
    .select('id, student_id, guardian_profile_id, status, level')
    .eq('id', consentId)
    .maybeSingle()
  if (loadError || !consent) throw new Error('Consent record not found')

  const authorizedIds = await getConsentGuardianStudentIds(caller.profileId)
  const isOwnRecord = consent.guardian_profile_id === caller.profileId
  if (!isOwnRecord && !authorizedIds.includes(consent.student_id)) {
    throw new Error('Access denied: you are not the consent guardian for this student')
  }

  if (consent.status !== 'active') {
    throw new Error('This consent record is no longer active')
  }

  const { data: updated, error: updateError } = await supabase
    .from('fina_consents')
    .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString() })
    .eq('id', consentId)
    .eq('status', 'active')
    .select()
    .single()
  if (updateError || !updated) throw new Error('Failed to withdraw consent — it may have already changed')

  invalidateConsentCache(consent.student_id)
  await logAuditFromCaller(caller, 'consent.withdrawn', {
    subjectType: 'student',
    subjectId: consent.student_id,
    meta: { previousLevel: consent.level },
  })

  // Reprocessing/notification (spec §8.4: reprocess the archive within 24h,
  // notify the principal without naming the student) is enqueued here so the
  // SLA clock starts at the moment of withdrawal, even though no worker
  // consumes 'reprocess_student_archive' jobs until Phase 3 lands — there is
  // no archive to reprocess yet in Phase 0/1 anyway (no posts exist).
  await enqueueFinaJob('reprocess_student_archive', { studentId: consent.student_id }, 1)

  return updated
}

/** GET /fina/consents/:id/certificate data — the frontend renders this into
 * a PDF client-side (ConsentCertificateButton.tsx, Phase 1), matching this
 * codebase's existing client-side jsPDF pattern. Returns the exact signed
 * text (re-looked-up by version, not trusted from any stored copy) alongside
 * the signature metadata. */
export async function getConsentCertificateData(caller: CallerContext, consentId: string) {
  const { data: consent, error } = await supabase.from('fina_consents').select('*').eq('id', consentId).maybeSingle()
  if (error || !consent) throw new Error('Consent record not found')

  if (caller.role !== 'admin') {
    const authorizedIds = await getConsentGuardianStudentIds(caller.profileId)
    const isOwnRecord = consent.guardian_profile_id === caller.profileId
    if (!isOwnRecord && !authorizedIds.includes(consent.student_id)) {
      throw new Error('Access denied')
    }
  }

  const text = getConsentText(consent.consent_text_version)
  return { ...consent, consentText: text }
}
