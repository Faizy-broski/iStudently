import { supabase } from '../config/supabase'
import { createRoom, getRoomOrThrow, type JitsiRoom } from './jitsi-room.service'
import { pushNotificationsService } from './push-notifications.service'
import type {
  OnlineClass,
  OnlineClassEnrollment,
  CreateOnlineClassRequestDTO,
} from '../types/online-class.types'

interface CallerContext {
  profileId: string
  role: string
  schoolId: string
}

const isPrivileged = (role: string) => role === 'super_admin' || role === 'admin'

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

async function getOrThrow(id: string): Promise<OnlineClass> {
  const { data, error } = await supabase.from('online_classes').select('*').eq('id', id).single()
  if (error || !data) throw new Error('Online class not found')
  return data as OnlineClass
}

function assertSameSchool(row: OnlineClass, caller: CallerContext) {
  if (caller.role === 'super_admin') return
  if (row.school_id !== caller.schoolId) throw new Error('Access denied: different school')
}

/** Owning teacher, or a same-school admin/super_admin. */
function assertOwnerOrAdmin(row: OnlineClass, caller: CallerContext) {
  if (isPrivileged(caller.role)) {
    assertSameSchool(row, caller)
    return
  }
  if (row.teacher_profile_id !== caller.profileId) {
    throw new Error('Access denied: not the owner of this request')
  }
}

/** Confirms `courseperiodId` is one of this teacher's own course_periods. */
async function assertOwnsCoursePeriod(courseperiodId: string, teacherProfileId: string): Promise<void> {
  const { data: staffRow, error: staffError } = await supabase
    .from('staff')
    .select('id')
    .eq('profile_id', teacherProfileId)
    .maybeSingle()

  if (staffError || !staffRow) throw new Error('No staff record found for this account')

  const { data: cp, error: cpError } = await supabase
    .from('course_periods')
    .select('id, teacher_id')
    .eq('id', courseperiodId)
    .maybeSingle()

  if (cpError || !cp) throw new Error('Course period not found')
  if (cp.teacher_id !== staffRow.id) throw new Error('This course period does not belong to you')
}

// ============================================================================
// TEACHER
// ============================================================================

export const submitRequest = async (dto: CreateOnlineClassRequestDTO): Promise<OnlineClass> => {
  if (!dto.title?.trim()) throw new Error('Title is required')
  // school_id/campus_id are NOT NULL columns with no default — without this
  // check a missing value (e.g. an admin-role caller, whose profile.campus_id
  // is never populated) would fall through to a raw Postgres constraint
  // error on insert instead of a clean message.
  if (!dto.school_id || !dto.campus_id) {
    throw new Error('No campus associated with your account — contact your school admin')
  }

  if (dto.class_type === 'existing_course') {
    if (!dto.course_period_id) throw new Error('course_period_id is required for an existing-course class')
    await assertOwnsCoursePeriod(dto.course_period_id, dto.teacher_profile_id)
  } else {
    if (!dto.student_capacity || dto.student_capacity <= 0) {
      throw new Error('student_capacity is required for an open-enrollment class')
    }
  }

  const { data, error } = await supabase
    .from('online_classes')
    .insert({
      school_id: dto.school_id,
      campus_id: dto.campus_id,
      teacher_profile_id: dto.teacher_profile_id,
      class_type: dto.class_type,
      course_period_id: dto.class_type === 'existing_course' ? dto.course_period_id : null,
      title: dto.title.trim(),
      description: dto.description || null,
      student_capacity: dto.class_type === 'external_open' ? dto.student_capacity : null,
      scheduled_days: dto.scheduled_days || null,
      session_start_time: dto.session_start_time || null,
      session_end_time: dto.session_end_time || null,
      start_date: dto.start_date || null,
      end_date: dto.end_date || null,
    })
    .select('*')
    .single()

  if (error) throw new Error(`Failed to submit request: ${error.message}`)

  pushNotificationsService
    .sendToRole(dto.school_id, 'admin', {
      title: 'New online class request',
      body: `${dto.title} — awaiting your approval`,
      url: '/admin/online-classes',
      tag: `online-class-${data.id}`,
    })
    .catch((err) => console.error('Push notify (new online class request) failed:', err))

  return data as OnlineClass
}

export const listMyRequests = async (teacherProfileId: string): Promise<OnlineClass[]> => {
  const { data, error } = await supabase
    .from('online_classes')
    .select('*')
    .eq('teacher_profile_id', teacherProfileId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to list requests: ${error.message}`)
  return data || []
}

export const cancelMyRequest = async (id: string, caller: CallerContext): Promise<void> => {
  const row = await getOrThrow(id)
  assertOwnerOrAdmin(row, caller)

  if (!['pending_review', 'approved', 'active'].includes(row.status)) {
    throw new Error(`Cannot cancel a request with status "${row.status}"`)
  }

  const { error } = await supabase.from('online_classes').update({ status: 'cancelled' }).eq('id', id)
  if (error) throw new Error(`Failed to cancel request: ${error.message}`)
}

export const startSession = async (id: string, caller: CallerContext): Promise<JitsiRoom> => {
  const row = await getOrThrow(id)
  assertOwnerOrAdmin(row, caller)

  if (row.status !== 'active' || !row.jitsi_room_id) {
    throw new Error('This class has not been approved/activated yet')
  }

  // Room creation happens exactly once, at approval — this only ever fetches
  // the already-created room, never creates a second one.
  return getRoomOrThrow(row.jitsi_room_id)
}

// ============================================================================
// ADMIN
// ============================================================================

export const listPendingForReview = async (schoolId: string, campusId?: string): Promise<OnlineClass[]> => {
  let query = supabase
    .from('online_classes')
    .select('*')
    .eq('school_id', schoolId)
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true })

  if (campusId) query = query.eq('campus_id', campusId)

  const { data, error } = await query
  if (error) throw new Error(`Failed to list pending requests: ${error.message}`)
  return data || []
}

export const approveRequest = async (
  id: string,
  caller: CallerContext,
  note?: string
): Promise<OnlineClass> => {
  if (!isPrivileged(caller.role)) throw new Error('Access denied: admin role required')
  const initialRow = await getOrThrow(id)
  assertSameSchool(initialRow, caller)

  // Atomic, exclusive claim: only one concurrent caller can ever match
  // status='pending_review' and flip it, so two simultaneous approve calls
  // (double-click, two admin tabs) can't both proceed into room creation /
  // roster snapshot below.
  const { data: claimed, error: claimError } = await supabase
    .from('online_classes')
    .update({
      status: 'approved',
      reviewer_profile_id: caller.profileId,
      review_note: note || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending_review')
    .select('*')
    .maybeSingle()

  if (claimError) throw new Error(`Failed to approve request: ${claimError.message}`)

  let row: OnlineClass
  if (claimed) {
    row = claimed as OnlineClass
  } else {
    // Someone else (or an earlier attempt by this same caller) already moved
    // this row past pending_review — figure out whether that's fine or not.
    const current = await getOrThrow(id)
    if (current.status === 'active') return current // already fully approved — idempotent success, not an error
    if (current.status === 'approved' && !current.jitsi_room_id && current.reviewer_profile_id === caller.profileId) {
      row = current // legitimate serial retry after a prior crash partway through
    } else {
      throw new Error(`Cannot approve a request with status "${current.status}"`)
    }
  }

  const room = row.jitsi_room_id
    ? await getRoomOrThrow(row.jitsi_room_id)
    : await createRoom({
        school_id: row.school_id,
        campus_id: row.campus_id,
        owner_profile_id: row.teacher_profile_id,
        title: row.title,
        description: row.description || undefined,
      })

  let enrolledCount = row.enrolled_count

  if (row.class_type === 'existing_course' && row.course_period_id && !row.jitsi_room_id) {
    // Only snapshot the roster the first time through (jitsi_room_id null
    // check guards against re-inserting on a retry after partial failure).
    const { data: schedules, error: schedError } = await supabase
      .from('student_schedules')
      .select('student_id')
      .eq('course_period_id', row.course_period_id)

    if (schedError) throw new Error(`Failed to load section roster: ${schedError.message}`)

    const studentIds = [...new Set((schedules || []).map((s: any) => s.student_id))]

    if (studentIds.length > 0) {
      // student_schedules.student_id -> students(id); enrollments are keyed
      // by profiles.id (student_profile_id) like everywhere else in this
      // module, so resolve students -> profile_id here.
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, profile_id')
        .in('id', studentIds)

      if (studentsError) throw new Error(`Failed to resolve student profiles: ${studentsError.message}`)

      const enrollmentRows = (students || [])
        .filter((s: any) => s.profile_id)
        .map((s: any) => ({ online_class_id: id, student_profile_id: s.profile_id }))

      if (enrollmentRows.length > 0) {
        const { error: insertError } = await supabase.from('online_class_enrollments').insert(enrollmentRows)
        // 23505 (unique violation) here means this exact roster was already
        // snapshotted by an earlier attempt on this same row (the serial-
        // retry path above) — treat as already-done, not a failure.
        if (insertError && (insertError as any).code !== '23505') {
          throw new Error(`Failed to snapshot section roster: ${insertError.message}`)
        }
      }
      enrolledCount = enrollmentRows.length
    }
  }

  const { data, error } = await supabase
    .from('online_classes')
    .update({ status: 'active', jitsi_room_id: room.id, enrolled_count: enrolledCount })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw new Error(`Failed to activate class: ${error.message}`)

  pushNotificationsService
    .sendToProfile(row.teacher_profile_id, {
      title: 'Your online class was approved',
      body: `"${row.title}" is now active — you can start it anytime.`,
      url: '/teacher/online-classes',
      tag: `online-class-${id}`,
    })
    .catch((err) => console.error('Push notify (online class approved) failed:', err))

  return data as OnlineClass
}

export const rejectRequest = async (
  id: string,
  caller: CallerContext,
  note?: string
): Promise<OnlineClass> => {
  if (!isPrivileged(caller.role)) throw new Error('Access denied: admin role required')
  const row = await getOrThrow(id)
  assertSameSchool(row, caller)

  if (row.status !== 'pending_review') {
    throw new Error(`Cannot reject a request with status "${row.status}"`)
  }

  const { data, error } = await supabase
    .from('online_classes')
    .update({
      status: 'rejected',
      reviewer_profile_id: caller.profileId,
      review_note: note || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw new Error(`Failed to reject request: ${error.message}`)

  pushNotificationsService
    .sendToProfile(row.teacher_profile_id, {
      title: 'Your online class request was declined',
      body: note ? `"${row.title}": ${note}` : `"${row.title}" was not approved.`,
      url: '/teacher/online-classes',
      tag: `online-class-${id}`,
    })
    .catch((err) => console.error('Push notify (online class rejected) failed:', err))

  return data as OnlineClass
}

// ============================================================================
// STUDENT
// ============================================================================

export const listOpenCourses = async (
  schoolId: string
): Promise<(OnlineClass & { seats_remaining: number })[]> => {
  const { data, error } = await supabase
    .from('online_classes')
    .select('*')
    .eq('school_id', schoolId)
    .eq('status', 'active')
    .eq('class_type', 'external_open')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to list open courses: ${error.message}`)
  return (data || []).map((row: OnlineClass) => ({
    ...row,
    seats_remaining: Math.max(0, (row.student_capacity ?? 0) - row.enrolled_count),
  }))
}

/** Result shape of the adjust_online_class_enrollment(class_id, delta) RPC. */
interface AdjustEnrollmentResult {
  success: boolean
  new_count: number | null
}

async function adjustEnrollment(classId: string, delta: number): Promise<AdjustEnrollmentResult> {
  const { data, error } = await supabase
    .rpc('adjust_online_class_enrollment', { p_class_id: classId, p_delta: delta })
    .single()
  if (error) throw new Error(`Failed to adjust enrollment count: ${error.message}`)
  return data as AdjustEnrollmentResult
}

export const enroll = async (id: string, caller: CallerContext): Promise<OnlineClassEnrollment> => {
  const row = await getOrThrow(id)
  if (row.class_type !== 'external_open') throw new Error('This class does not use self-enrollment')
  if (row.status !== 'active') throw new Error('This class is not open for enrollment')

  // A prior withdrawal leaves a 'withdrawn' row behind (never deleted) — the
  // UNIQUE(online_class_id, student_profile_id) constraint means a second
  // plain INSERT would always fail for a returning student, so reactivate
  // the existing row instead of inserting a new one.
  const { data: existing, error: existingError } = await supabase
    .from('online_class_enrollments')
    .select('id, status')
    .eq('online_class_id', id)
    .eq('student_profile_id', caller.profileId)
    .maybeSingle()

  if (existingError) throw new Error(`Failed to enroll: ${existingError.message}`)
  if (existing?.status === 'enrolled') throw new Error('You are already enrolled in this class')

  // Atomic, capacity-checked counter bump — replaces the old client-side
  // optimistic-CAS approach, which had a real corruption hole in its rollback.
  const adj = await adjustEnrollment(id, 1)
  if (!adj.success) throw new Error('This class is full')

  if (existing) {
    const { data, error } = await supabase
      .from('online_class_enrollments')
      .update({ status: 'enrolled', enrolled_at: new Date().toISOString(), withdrawn_at: null })
      .eq('id', existing.id)
      .select('*')
      .single()

    if (error) {
      await adjustEnrollment(id, -1)
      throw new Error(`Failed to enroll: ${error.message}`)
    }
    return data as OnlineClassEnrollment
  }

  const { data, error } = await supabase
    .from('online_class_enrollments')
    .insert({ online_class_id: id, student_profile_id: caller.profileId })
    .select('*')
    .single()

  if (error) {
    // Real atomic decrement now (not a blind reset) — correct under any
    // concurrent interleaving with other students' enroll/withdraw calls.
    await adjustEnrollment(id, -1)
    if ((error as any).code === '23505') throw new Error('You are already enrolled in this class')
    throw new Error(`Failed to enroll: ${error.message}`)
  }

  return data as OnlineClassEnrollment
}

export const withdraw = async (id: string, caller: CallerContext): Promise<void> => {
  const { data: enrollment, error: fetchError } = await supabase
    .from('online_class_enrollments')
    .select('*')
    .eq('online_class_id', id)
    .eq('student_profile_id', caller.profileId)
    .eq('status', 'enrolled')
    .maybeSingle()

  if (fetchError) throw new Error(`Failed to withdraw: ${fetchError.message}`)
  if (!enrollment) throw new Error('You are not enrolled in this class')

  const { error } = await supabase
    .from('online_class_enrollments')
    .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString() })
    .eq('id', enrollment.id)

  if (error) throw new Error(`Failed to withdraw: ${error.message}`)

  // Atomic decrement — two concurrent withdrawals reading the same stale
  // count would otherwise both apply -1 off the same base, overcounting.
  await adjustEnrollment(id, -1)
}

export const listMyEnrollments = async (studentProfileId: string): Promise<OnlineClass[]> => {
  const { data, error } = await supabase
    .from('online_class_enrollments')
    .select('online_class:online_classes(*)')
    .eq('student_profile_id', studentProfileId)
    .eq('status', 'enrolled')
    .order('enrolled_at', { ascending: false })

  if (error) throw new Error(`Failed to list enrollments: ${error.message}`)
  return (data || []).map((r: any) => r.online_class).filter(Boolean)
}
