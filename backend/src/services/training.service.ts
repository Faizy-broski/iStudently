import { supabase } from '../config/supabase'
import {
  TrainingSession,
  CourseRegistration,
  CreateTrainingSessionDTO,
  UpdateTrainingSessionDTO,
  RegisterForTrainingDTO,
} from '../types'

export class TrainingService {
  // Sessions created at the parent-school level should accept students from
  // any of that parent's child campuses, not just an exact school_id match.
  private async resolveEligibleSchoolIds(schoolId: string): Promise<string[]> {
    const { data: campuses } = await supabase
      .from('schools')
      .select('id')
      .eq('parent_school_id', schoolId)
    return [schoolId, ...(campuses ?? []).map((c: any) => c.id)]
  }

  // ─── Admin: Sessions ──────────────────────────────────────────────────────

  async listSessions(schoolId: string, parentSchoolId?: string): Promise<TrainingSession[]> {
    const ids = parentSchoolId ? [schoolId, parentSchoolId] : [schoolId]
    const { data, error } = await supabase
      .from('training_sessions')
      .select('*')
      .in('school_id', ids)
      .order('start_date', { ascending: false })

    if (error) throw error

    return (data ?? []).map((s: any) => ({
      ...s,
      available_seats: s.total_seats - s.registered_seats,
    }))
  }

  async createSession(
    schoolId: string,
    dto: CreateTrainingSessionDTO
  ): Promise<TrainingSession> {
    const payload: Record<string, any> = {
      school_id: schoolId,
      title: dto.title,
      description: dto.description ?? null,
      category: dto.category ?? null,
      skill_level: dto.skill_level ?? 'beginner',
      start_date: dto.start_date,
      end_date: dto.end_date,
      weekly_days: dto.weekly_days ?? null,
      daily_time_range: dto.daily_time_range ?? null,
      daily_times: dto.daily_times ?? null,
      total_duration_hours: dto.total_duration_hours ?? null,
      delivery_mode: dto.delivery_mode ?? 'in_person',
      location_venue_link: dto.location_venue_link ?? null,
      instructor_id: dto.instructor_id ?? null,
      instructor_name: dto.instructor_name ?? null,
      total_seats: dto.total_seats,
      course_fee: dto.course_fee ?? 0,
      registration_deadline: dto.registration_deadline ?? null,
      holding_timeout_hours: dto.holding_timeout_hours ?? 24,
      status: dto.status ?? 'open',
      target_audience: dto.target_audience ?? 'both',
      cover_image_url: dto.cover_image_url ?? null,
      syllabus_pdf_url: dto.syllabus_pdf_url ?? null,
      certificate_settings: dto.certificate_settings ?? null,
    }

    let { data, error } = await supabase
      .from('training_sessions')
      .insert(payload)
      .select()
      .single()

    // Resilient fallback: If DB schema cache is missing optional new columns, strip unaccepted columns & retry
    while (error) {
      const match = error.message?.match(/Could not find the '([^']+)' column/)
      if (match && match[1] && match[1] in payload) {
        delete payload[match[1]]
        const retry = await supabase
          .from('training_sessions')
          .insert(payload)
          .select()
          .single()
        data = retry.data
        error = retry.error
      } else {
        break
      }
    }

    if (error) throw error
    return { ...data, available_seats: data.total_seats - data.registered_seats }
  }

  async getSessionById(
    sessionId: string,
    schoolId: string,
    parentSchoolId?: string
  ): Promise<TrainingSession | null> {
    const ids = parentSchoolId ? [schoolId, parentSchoolId] : [schoolId]
    const { data: session, error } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('id', sessionId)
      .in('school_id', ids)
      .single()

    if (error) return null

    // Fetch registration counts per status
    const { data: counts } = await supabase
      .from('course_registrations')
      .select('registration_status, payment_status')
      .eq('session_id', sessionId)

    const registration_counts = { confirmed_paid: 0, confirmed_unpaid: 0, waiting_list: 0, cancelled: 0 }
    for (const row of counts ?? []) {
      if (row.registration_status === 'confirmed') {
        if (row.payment_status === 'paid') registration_counts.confirmed_paid++
        else registration_counts.confirmed_unpaid++
      } else if (row.registration_status === 'waiting_list') {
        registration_counts.waiting_list++
      } else if (row.registration_status === 'cancelled') {
        registration_counts.cancelled++
      }
    }

    return {
      ...session,
      available_seats: session.total_seats - session.registered_seats,
      registration_counts,
    }
  }

  async updateSession(
    sessionId: string,
    schoolId: string,
    dto: UpdateTrainingSessionDTO,
    parentSchoolId?: string
  ): Promise<TrainingSession> {
    const ids = parentSchoolId ? [schoolId, parentSchoolId] : [schoolId]

    const updatePayload: Record<string, any> = {}
    if (dto.title !== undefined) updatePayload.title = dto.title
    if (dto.description !== undefined) updatePayload.description = dto.description
    if (dto.category !== undefined) updatePayload.category = dto.category
    if (dto.skill_level !== undefined) updatePayload.skill_level = dto.skill_level
    if (dto.start_date !== undefined) updatePayload.start_date = dto.start_date
    if (dto.end_date !== undefined) updatePayload.end_date = dto.end_date
    if (dto.weekly_days !== undefined) updatePayload.weekly_days = dto.weekly_days
    if (dto.daily_time_range !== undefined) updatePayload.daily_time_range = dto.daily_time_range
    if (dto.daily_times !== undefined) updatePayload.daily_times = dto.daily_times
    if (dto.total_duration_hours !== undefined) updatePayload.total_duration_hours = dto.total_duration_hours
    if (dto.delivery_mode !== undefined) updatePayload.delivery_mode = dto.delivery_mode
    if (dto.location_venue_link !== undefined) updatePayload.location_venue_link = dto.location_venue_link
    if (dto.instructor_id !== undefined) updatePayload.instructor_id = dto.instructor_id
    if (dto.instructor_name !== undefined) updatePayload.instructor_name = dto.instructor_name
    if (dto.total_seats !== undefined) updatePayload.total_seats = dto.total_seats
    if (dto.course_fee !== undefined) updatePayload.course_fee = dto.course_fee
    if (dto.registration_deadline !== undefined) updatePayload.registration_deadline = dto.registration_deadline
    if (dto.holding_timeout_hours !== undefined) updatePayload.holding_timeout_hours = dto.holding_timeout_hours
    if (dto.status !== undefined) updatePayload.status = dto.status
    if (dto.target_audience !== undefined) updatePayload.target_audience = dto.target_audience
    if (dto.cover_image_url !== undefined) updatePayload.cover_image_url = dto.cover_image_url
    if (dto.syllabus_pdf_url !== undefined) updatePayload.syllabus_pdf_url = dto.syllabus_pdf_url
    if (dto.certificate_settings !== undefined) updatePayload.certificate_settings = dto.certificate_settings

    // Validate seat reduction doesn't undercut current registrations
    if (dto.total_seats !== undefined) {
      const { data: current } = await supabase
        .from('training_sessions')
        .select('registered_seats')
        .eq('id', sessionId)
        .in('school_id', ids)
        .single()

      if (current && dto.total_seats < current.registered_seats) {
        throw new Error(
          `Cannot reduce total seats to ${dto.total_seats}: ${current.registered_seats} seats already registered`
        )
      }
    }

    updatePayload.updated_at = new Date().toISOString()

    let { data, error } = await supabase
      .from('training_sessions')
      .update(updatePayload)
      .eq('id', sessionId)
      .in('school_id', ids)
      .select()
      .single()

    // Resilient fallback: If DB schema cache is missing optional new columns, strip unaccepted columns & retry
    while (error) {
      const match = error.message?.match(/Could not find the '([^']+)' column/)
      if (match && match[1] && match[1] in updatePayload) {
        delete updatePayload[match[1]]
        const retry = await supabase
          .from('training_sessions')
          .update(updatePayload)
          .eq('id', sessionId)
          .in('school_id', ids)
          .select()
          .single()
        data = retry.data
        error = retry.error
      } else {
        break
      }
    }

    if (error) throw error
    return { ...data, available_seats: data.total_seats - data.registered_seats }
  }

  // Returns whether a row was actually deleted — a delete that matches zero
  // rows (e.g. wrong school scope) does not error, it just silently affects
  // nothing, so the caller needs an explicit signal to report that as a 404
  // instead of a false "success".
  async deleteSession(sessionId: string, schoolId: string, parentSchoolId?: string): Promise<boolean> {
    const ids = parentSchoolId ? [schoolId, parentSchoolId] : [schoolId]
    const { data, error } = await supabase
      .from('training_sessions')
      .delete()
      .eq('id', sessionId)
      .in('school_id', ids)
      .select('id')

    if (error) throw error
    return (data?.length ?? 0) > 0
  }

  // ─── Admin: Registrations ─────────────────────────────────────────────────

  async listRegistrations(
    sessionId: string,
    schoolId: string,
    filters: {
      registration_status?: string
      payment_status?: string
      paid?: string
      search?: string
    },
    page: number = 1,
    limit: number = 20,
    parentSchoolId?: string
  ): Promise<{ data: CourseRegistration[]; pagination: object }> {
    // Verify session belongs to school (or its parent school, for campus-scoped viewing)
    const ids = parentSchoolId ? [schoolId, parentSchoolId] : [schoolId]
    const { data: session } = await supabase
      .from('training_sessions')
      .select('id')
      .eq('id', sessionId)
      .in('school_id', ids)
      .single()

    if (!session) throw new Error('Session not found')

    const offset = (page - 1) * limit

    let query = supabase
      .from('course_registrations')
      .select('*, student:students(id, student_number, profile:profiles(first_name, last_name))', {
        count: 'exact',
      })
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (filters.registration_status) {
      query = query.eq('registration_status', filters.registration_status)
    }
    if (filters.payment_status) {
      query = query.eq('payment_status', filters.payment_status)
    }
    if (filters.paid === 'true') {
      query = query.eq('payment_status', 'paid')
    } else if (filters.paid === 'false') {
      query = query.neq('payment_status', 'paid')
    }

    const { data, error, count } = await query
    if (error) throw error

    const enriched: CourseRegistration[] = (data ?? []).map((r: any) => ({
      ...r,
      display_name:
        r.student_type === 'internal'
          ? `${r.student?.profile?.first_name ?? ''} ${r.student?.profile?.last_name ?? ''}`.trim() ||
            r.student?.student_number
          : r.ext_student_name,
    }))

    const totalCount = count ?? 0
    return {
      data: enriched,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    }
  }

  async exportRegistrationsCSV(sessionId: string, schoolId: string, parentSchoolId?: string): Promise<string> {
    const ids = parentSchoolId ? [schoolId, parentSchoolId] : [schoolId]
    const { data: session } = await supabase
      .from('training_sessions')
      .select('title')
      .eq('id', sessionId)
      .in('school_id', ids)
      .single()

    if (!session) throw new Error('Session not found')

    const { data, error } = await supabase
      .from('course_registrations')
      .select('*, student:students(student_number, profile:profiles(first_name, last_name))')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })

    if (error) throw error

    const headers = [
      'Name',
      'Type',
      'Contact / Phone',
      'Payment Status',
      'Registration Status',
      'Attendance',
      'Registered At',
    ]

    const rows = (data ?? []).map((r: any) => {
      const name =
        r.student_type === 'internal'
          ? `${r.student?.profile?.first_name ?? ''} ${r.student?.profile?.last_name ?? ''}`.trim() ||
            r.student?.student_number
          : r.ext_student_name
      const contact = r.student_type === 'external' ? (r.ext_parent_phone ?? '') : ''
      return [
        `"${name}"`,
        r.student_type,
        `"${contact}"`,
        r.payment_status,
        r.registration_status,
        r.attendance_status ? 'Yes' : 'No',
        r.created_at,
      ].join(',')
    })

    return [headers.join(','), ...rows].join('\n')
  }

  async toggleAttendance(
    registrationId: string,
    sessionId: string,
    schoolId: string
  ): Promise<CourseRegistration> {
    // Ownership check via session
    const { data: session } = await supabase
      .from('training_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('school_id', schoolId)
      .single()

    if (!session) throw new Error('Session not found')

    const { data: reg } = await supabase
      .from('course_registrations')
      .select('attendance_status')
      .eq('id', registrationId)
      .eq('session_id', sessionId)
      .single()

    if (!reg) throw new Error('Registration not found')

    const { data, error } = await supabase
      .from('course_registrations')
      .update({ attendance_status: !reg.attendance_status })
      .eq('id', registrationId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updatePaymentStatus(
    registrationId: string,
    sessionId: string,
    schoolId: string,
    status: string
  ): Promise<CourseRegistration> {
    const allowed = ['unpaid', 'pending_verification', 'paid', 'expired']
    if (!allowed.includes(status)) throw new Error('Invalid payment status')

    const { data: session } = await supabase
      .from('training_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('school_id', schoolId)
      .single()

    if (!session) throw new Error('Session not found')

    const { data, error } = await supabase
      .from('course_registrations')
      .update({ payment_status: status })
      .eq('id', registrationId)
      .eq('session_id', sessionId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async cancelRegistration(
    registrationId: string,
    sessionId: string,
    schoolId: string
  ): Promise<void> {
    const { data: session } = await supabase
      .from('training_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('school_id', schoolId)
      .single()

    if (!session) throw new Error('Session not found')

    const { data: reg } = await supabase
      .from('course_registrations')
      .select('registration_status')
      .eq('id', registrationId)
      .eq('session_id', sessionId)
      .single()

    if (!reg) throw new Error('Registration not found')

    await supabase
      .from('course_registrations')
      .update({ registration_status: 'cancelled' })
      .eq('id', registrationId)

    // Free the seat if it was a confirmed registration
    if (reg.registration_status === 'confirmed') {
      await supabase.rpc('decrement_training_seat', { p_session_id: sessionId })
    }
  }

  async promoteWaitlistRecord(
    registrationId: string,
    sessionId: string,
    schoolId: string
  ): Promise<boolean> {
    const { data: session } = await supabase
      .from('training_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('school_id', schoolId)
      .single()

    if (!session) throw new Error('Session not found')

    const { data: success, error } = await supabase.rpc('promote_waitlist_seat', {
      p_session_id: sessionId,
      p_registration_id: registrationId,
    })

    if (error) throw error
    return success === true
  }

  async hardDeleteRegistration(
    registrationId: string,
    sessionId: string,
    schoolId: string
  ): Promise<void> {
    const { data: session } = await supabase
      .from('training_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('school_id', schoolId)
      .single()

    if (!session) throw new Error('Session not found')

    const { data: reg } = await supabase
      .from('course_registrations')
      .select('registration_status')
      .eq('id', registrationId)
      .eq('session_id', sessionId)
      .single()

    if (!reg) throw new Error('Registration not found')

    const wasConfirmed = reg.registration_status === 'confirmed'

    const { error } = await supabase
      .from('course_registrations')
      .delete()
      .eq('id', registrationId)
      .eq('session_id', sessionId)

    if (error) throw error

    if (wasConfirmed) {
      await supabase.rpc('decrement_training_seat', { p_session_id: sessionId })
    }
  }

  // ─── Public: Session Info ─────────────────────────────────────────────────

  async getPublicSession(token: string): Promise<Partial<TrainingSession> | null> {
    const { data, error } = await supabase
      .from('training_sessions')
      .select(
        'id, title, description, start_date, end_date, total_seats, registered_seats, course_fee, status, target_audience, public_token'
      )
      .eq('public_token', token)
      .single()

    if (error || !data) return null

    return {
      ...data,
      available_seats: data.total_seats - data.registered_seats,
    }
  }

  async lookupStudentByNumber(
    studentNumber: string,
    token: string
  ): Promise<{ id: string; first_name: string; last_name: string } | null> {
    // Resolve school_id from the session token
    const { data: session } = await supabase
      .from('training_sessions')
      .select('school_id')
      .eq('public_token', token)
      .single()

    if (!session) return null

    const eligibleSchoolIds = await this.resolveEligibleSchoolIds(session.school_id)

    const { data, error } = await supabase
      .from('students')
      .select('id, profile:profiles(first_name, last_name)')
      .eq('student_number', studentNumber)
      .in('school_id', eligibleSchoolIds)
      .single()

    if (error || !data) return null

    const profile = (data as any).profile
    return {
      id: data.id,
      first_name: profile?.first_name ?? '',
      last_name: profile?.last_name ?? '',
    }
  }

  async registerForSession(
    token: string,
    dto: RegisterForTrainingDTO
  ): Promise<{ registration_status: string; qr_auth_token: string }> {
    const { data: session } = await supabase
      .from('training_sessions')
      .select('id, school_id, status, target_audience')
      .eq('public_token', token)
      .single()

    if (!session) throw new Error('Session not found')
    if (session.status === 'closed') throw new Error('Registration is closed for this session')

    // Validate audience eligibility
    if (session.target_audience !== 'both' && session.target_audience !== dto.student_type) {
      throw new Error(`This session is only open to ${session.target_audience} students`)
    }

    // For internal: verify the student_id belongs to this school
    if (dto.student_type === 'internal') {
      if (!dto.student_id) throw new Error('student_id is required for internal registration')
      const eligibleSchoolIds = await this.resolveEligibleSchoolIds(session.school_id)
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('id', dto.student_id)
        .in('school_id', eligibleSchoolIds)
        .single()
      if (!student) throw new Error('Student not found in this school')
    } else {
      if (!dto.ext_student_name) throw new Error('ext_student_name is required for external registration')
    }

    // Atomically attempt to claim a seat
    const { data: seatSecured, error: rpcError } = await supabase.rpc(
      'increment_training_seat',
      { p_session_id: session.id }
    )

    if (rpcError) throw rpcError

    const registration_status = seatSecured ? 'confirmed' : 'waiting_list'

    const { data: registration, error: insertError } = await supabase
      .from('course_registrations')
      .insert({
        session_id: session.id,
        student_type: dto.student_type,
        student_id: dto.student_type === 'internal' ? dto.student_id : null,
        ext_student_name: dto.student_type === 'external' ? dto.ext_student_name : null,
        ext_student_age: dto.student_type === 'external' ? (dto.ext_student_age ?? null) : null,
        ext_parent_phone: dto.student_type === 'external' ? (dto.ext_parent_phone ?? null) : null,
        ext_current_school: dto.student_type === 'external' ? (dto.ext_current_school ?? null) : null,
        registration_status,
      })
      .select('qr_auth_token')
      .single()

    if (insertError) throw insertError

    return {
      registration_status,
      qr_auth_token: registration.qr_auth_token,
    }
  }
}

export const trainingService = new TrainingService()
