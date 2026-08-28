import { supabase } from '../../config/supabase'
import { CallerContext } from './types'
import { getGuardianStudentIds, getGuardianProfileIdsForStudent } from './access-policy.service'
import { logAuditFromCaller } from './audit-logger.service'

/**
 * Archived messaging (spec §7.5, §12, §21's "🔒 archived and visible to
 * school administration" banner). Deliberately NEW tables, not a reuse of
 * the unrelated existing messaging.service.ts (generic DMs) or portal_notes
 * — see 250_create_fina_threads_messages.sql's header.
 *
 * fina_threads has TWO foreign keys to profiles (teacher_id, guardian_id) —
 * every embed below uses the explicit `!constraint` hint, the same fix
 * required for fina_posts (4 FKs) and fina_comments (2 FKs) earlier; PostgREST
 * rejects a bare `profiles(...)` embed as ambiguous whenever more than one
 * FK path exists between the two tables, even for a single-sided embed.
 */

// super_admin excluded — spec §12: SYSADMIN's Messages access is explicitly
// ❌, unlike PRINCIPAL's (admin's) "view" oversight access.
const OVERSIGHT_ROLES = ['admin']

async function resolveStaffId(profileId: string): Promise<string | null> {
  const { data } = await supabase.from('staff').select('id').eq('profile_id', profileId).maybeSingle()
  return data?.id ?? null
}

async function teacherTeachesSection(teacherProfileId: string, sectionId: string | null): Promise<boolean> {
  if (!sectionId) return false
  const staffId = await resolveStaffId(teacherProfileId)
  if (!staffId) return false
  const { data } = await supabase.from('teacher_subject_assignments').select('id').eq('teacher_id', staffId).eq('section_id', sectionId).limit(1)
  return (data?.length ?? 0) > 0
}

export interface GetOrCreateThreadInput {
  teacherProfileId?: string
  guardianProfileId?: string
  studentId: string
}

/** Either party may start the conversation — a teacher naming the guardian,
 * or a guardian naming the teacher — but the (teacher, guardian, student)
 * triple is always independently verified server-side regardless of who
 * calls this, never trusted from either side's own claim. */
export async function getOrCreateThread(caller: CallerContext, input: GetOrCreateThreadInput) {
  let teacherProfileId = input.teacherProfileId
  let guardianProfileId = input.guardianProfileId

  if (caller.role === 'teacher') {
    teacherProfileId = caller.profileId
  } else if (caller.role === 'parent') {
    guardianProfileId = caller.profileId
  } else {
    throw new Error('Access denied: only a teacher or a guardian may start a conversation')
  }
  if (!teacherProfileId || !guardianProfileId) throw new Error('Both a teacher and a guardian are required')

  const { data: student } = await supabase.from('students').select('id, school_id, section_id').eq('id', input.studentId).maybeSingle()
  if (!student) throw new Error('Student not found')
  // caller is guaranteed 'teacher' or 'parent' here (super_admin never
  // reaches this point — see the role check above), both strictly
  // single-campus roles, so a plain equality check is correct.
  if (student.school_id !== caller.schoolId) throw new Error('Access denied')

  const [teaches, isGuardian] = await Promise.all([
    teacherTeachesSection(teacherProfileId, student.section_id),
    getGuardianStudentIds(guardianProfileId).then((ids) => ids.includes(input.studentId)),
  ])
  if (!teaches) throw new Error('Access denied: this teacher does not teach this student')
  if (!isGuardian) throw new Error('Access denied: not a guardian of this student')

  const { data: existing } = await supabase
    .from('fina_threads')
    .select('*')
    .eq('teacher_id', teacherProfileId)
    .eq('guardian_id', guardianProfileId)
    .eq('student_id', input.studentId)
    .maybeSingle()
  if (existing) return existing

  const { data: created, error } = await supabase
    .from('fina_threads')
    .insert({ school_id: student.school_id, teacher_id: teacherProfileId, guardian_id: guardianProfileId, student_id: input.studentId })
    .select()
    .single()
  if (error || !created) throw new Error(`Failed to start conversation: ${error?.message}`)

  await logAuditFromCaller(caller, 'thread.created', { subjectType: 'thread', subjectId: created.id })
  return created
}

async function loadThreadForAccess(threadId: string) {
  const { data, error } = await supabase.from('fina_threads').select('*').eq('id', threadId).maybeSingle()
  if (error || !data) throw new Error('Conversation not found')
  return data
}

/** Participants can read AND send. Admin (PRINCIPAL) at the same school can
 * only READ (the spec's "archived, visible to school administration"
 * oversight) — never send on someone else's behalf. super_admin has no
 * access at all here (spec §12: SYSADMIN's Messages column is ❌). */
function assertThreadAccess(caller: CallerContext, thread: { school_id: string; teacher_id: string; guardian_id: string }, requireSend: boolean) {
  const isParticipant = caller.profileId === thread.teacher_id || caller.profileId === thread.guardian_id
  if (isParticipant) return
  if (!requireSend && OVERSIGHT_ROLES.includes(caller.role) && thread.school_id === caller.schoolId) return
  throw new Error('Access denied')
}

export async function sendMessage(caller: CallerContext, threadId: string, body: string) {
  if (!body?.trim()) throw new Error('Message body is required')
  const thread = await loadThreadForAccess(threadId)
  assertThreadAccess(caller, thread, true)

  const { data: created, error } = await supabase
    .from('fina_messages')
    .insert({ thread_id: threadId, sender_id: caller.profileId, body: body.trim() })
    .select()
    .single()
  if (error || !created) throw new Error(`Failed to send message: ${error?.message}`)

  await supabase.from('fina_threads').update({ last_message_at: new Date().toISOString() }).eq('id', threadId)
  return created
}

export async function listMessages(caller: CallerContext, threadId: string) {
  const thread = await loadThreadForAccess(threadId)
  assertThreadAccess(caller, thread, false)

  const { data, error } = await supabase
    .from('fina_messages')
    .select('*, sender:profiles(first_name, last_name, role)')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`Failed to load messages: ${error.message}`)

  // Mark the caller's own unread (received) messages as read — never marks
  // the admin oversight read, since a read receipt from an uninvolved
  // viewer would be a misleading signal to the participants.
  const isParticipant = caller.profileId === thread.teacher_id || caller.profileId === thread.guardian_id
  if (isParticipant) {
    await supabase.from('fina_messages').update({ read_at: new Date().toISOString() }).eq('thread_id', threadId).is('read_at', null).neq('sender_id', caller.profileId)
  }

  return data || []
}

export async function listMyThreads(caller: CallerContext) {
  if (caller.role === 'teacher') {
    const { data, error } = await supabase
      .from('fina_threads')
      .select('*, guardian:profiles!fina_threads_guardian_id_fkey(first_name, last_name), student:students(id, profile:profiles(first_name, last_name))')
      .eq('teacher_id', caller.profileId)
      .order('last_message_at', { ascending: false })
    if (error) throw new Error(`Failed to load conversations: ${error.message}`)
    return data || []
  }
  if (caller.role === 'parent') {
    const { data, error } = await supabase
      .from('fina_threads')
      .select('*, teacher:profiles!fina_threads_teacher_id_fkey(first_name, last_name), student:students(id, profile:profiles(first_name, last_name))')
      .eq('guardian_id', caller.profileId)
      .order('last_message_at', { ascending: false })
    if (error) throw new Error(`Failed to load conversations: ${error.message}`)
    return data || []
  }
  if (OVERSIGHT_ROLES.includes(caller.role)) {
    const { data, error } = await supabase
      .from('fina_threads')
      .select(
        '*, teacher:profiles!fina_threads_teacher_id_fkey(first_name, last_name), guardian:profiles!fina_threads_guardian_id_fkey(first_name, last_name), student:students(id, profile:profiles(first_name, last_name))'
      )
      .eq('school_id', caller.schoolId)
      .order('last_message_at', { ascending: false })
    if (error) throw new Error(`Failed to load conversations: ${error.message}`)
    return data || []
  }
  throw new Error('Access denied')
}

/** Feeds the "start a conversation" picker: a guardian's own wards (to pick
 * which child the conversation is about). */
export async function listMyWardsForThreads(caller: CallerContext) {
  if (caller.role !== 'parent') throw new Error('Access denied: guardian access required')
  const studentIds = await getGuardianStudentIds(caller.profileId)
  if (studentIds.length === 0) return []
  const { data, error } = await supabase.from('students').select('id, section_id, profile:profiles(first_name, last_name)').in('id', studentIds)
  if (error) throw new Error(`Failed to load wards: ${error.message}`)
  return (data || []).map((s: any) => ({ id: s.id, sectionId: s.section_id, name: [s.profile?.first_name, s.profile?.last_name].filter(Boolean).join(' ') }))
}

/** Feeds the "start a conversation" picker's first step for a teacher-
 * initiated thread (the mirror of listMyWardsForThreads above): every
 * student across every section this teacher is assigned to. */
export async function listMyStudentsForThreads(caller: CallerContext) {
  if (caller.role !== 'teacher') throw new Error('Access denied: teacher access required')
  const staffId = await resolveStaffId(caller.profileId)
  if (!staffId) return []
  const { data: assignments } = await supabase.from('teacher_subject_assignments').select('section_id').eq('teacher_id', staffId)
  const sectionIds = [...new Set((assignments || []).map((a) => a.section_id as string).filter(Boolean))]
  if (sectionIds.length === 0) return []
  const { data, error } = await supabase.from('students').select('id, section_id, profile:profiles(first_name, last_name)').in('section_id', sectionIds)
  if (error) throw new Error(`Failed to load students: ${error.message}`)
  return (data || []).map((s: any) => ({ id: s.id, sectionId: s.section_id, name: [s.profile?.first_name, s.profile?.last_name].filter(Boolean).join(' ') }))
}

/** Feeds the "start a conversation" picker's second step: for a guardian,
 * the student's teachers; for a teacher, the student's guardians. Two
 * separate queries per branch rather than a single nested embed — avoids
 * any risk of the ambiguous-FK embed issue this module hit twice already
 * (fina_posts, fina_comments) on a table (`staff`) whose exact FK count to
 * `profiles` wasn't independently confirmed while writing this. */
export async function listContactsForStudent(caller: CallerContext, studentId: string) {
  const { data: student } = await supabase.from('students').select('id, school_id, section_id').eq('id', studentId).maybeSingle()
  if (!student) throw new Error('Student not found')
  if (student.school_id !== caller.schoolId) throw new Error('Access denied')

  if (caller.role === 'parent') {
    const isGuardian = (await getGuardianStudentIds(caller.profileId)).includes(studentId)
    if (!isGuardian) throw new Error('Access denied')
    if (!student.section_id) return []

    const { data: assignments } = await supabase.from('teacher_subject_assignments').select('teacher_id').eq('section_id', student.section_id)
    const staffIds = [...new Set((assignments || []).map((a) => a.teacher_id as string))]
    if (staffIds.length === 0) return []

    const { data: staffRows } = await supabase.from('staff').select('id, profile_id').in('id', staffIds)
    const profileIds = [...new Set((staffRows || []).map((s) => s.profile_id as string).filter(Boolean))]
    if (profileIds.length === 0) return []

    const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name').in('id', profileIds)
    return (profiles || []).map((p) => ({ id: p.id, name: [p.first_name, p.last_name].filter(Boolean).join(' ') }))
  }

  if (caller.role === 'teacher') {
    const teaches = await teacherTeachesSection(caller.profileId, student.section_id)
    if (!teaches) throw new Error('Access denied')

    const guardianProfileIds = await getGuardianProfileIdsForStudent(studentId)
    if (guardianProfileIds.length === 0) return []
    const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name').in('id', guardianProfileIds)
    return (profiles || []).map((p) => ({ id: p.id, name: [p.first_name, p.last_name].filter(Boolean).join(' ') }))
  }

  throw new Error('Access denied')
}
