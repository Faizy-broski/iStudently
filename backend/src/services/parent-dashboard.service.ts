import { supabase } from '../config/supabase'

export interface ParentStudent {
  id: string
  student_number: string
  first_name: string
  last_name: string
  grade_level: string
  section: string
  campus_id: string
  campus_name: string
  profile_photo_url?: string
}

export interface AttendanceToday {
  status: 'present' | 'absent' | 'late' | 'excused' | 'not_marked'
  date: string
  marked_at?: string
}

export interface FeeStatus {
  total_due: number
  overdue_amount: number
  next_due_date?: string
  next_due_amount?: number
  unpaid_invoices: number
}

export interface UpcomingExam {
  id: string
  exam_name: string
  subject: string
  date: string
  time?: string
  total_marks: number
  days_until: number
}

export interface RecentGrade {
  subject: string
  marks_obtained: number
  total_marks: number
  percentage: number
  grade: string
  exam_type: string
  date: string
}

export interface AttendanceRecord {
  date: string
  status: 'present' | 'absent' | 'late' | 'excused'
  marked_by?: string
}

export interface GradebookEntry {
  subject: string
  current_marks: number
  total_marks: number
  percentage: number
  grade: string
  assignments_submitted: number
  assignments_total: number
}

export interface HomeworkAssignment {
  id: string
  subject: string
  title: string
  description: string
  due_date: string
  assigned_date: string
  status: 'pending' | 'submitted' | 'overdue'
  submission_date?: string
  teacher_name: string
}

export interface DashboardData {
  student: ParentStudent
  attendance_today: AttendanceToday
  fee_status: FeeStatus
  upcoming_exam: UpcomingExam | null
  recent_grade: RecentGrade | null
}

class ParentDashboardService {
  /**
   * Get list of all children for a parent
   */
  async getStudentsList(parentId: string): Promise<ParentStudent[]> {
    const { data, error } = await supabase
      .from('parent_student_links')
      .select(`
        student:students!inner(
          id,
          student_number,
          profile:profiles!students_profile_id_fkey(
            first_name,
            last_name,
            profile_photo_url
          ),
          grade_level,
          section_id,
          sections(
            name
          ),
          school_id,
          school:schools!students_school_id_fkey(
            name
          )
        )
      `)
      .eq('parent_id', parentId)

    if (error) throw error

    return (data || []).map((ps: any) => ({
      id: ps.student.id,
      student_number: ps.student.student_number,
      first_name: ps.student.profile.first_name,
      last_name: ps.student.profile.last_name,
      grade_level: ps.student.grade_level,
      section: ps.student.sections?.name || 'N/A',
      campus_id: ps.student.school_id,
      campus_name: ps.student.school.name,
      profile_photo_url: ps.student.profile.profile_photo_url
    }))
  }

  /**
   * Get today's attendance status for a student
   */
  async getAttendanceToday(studentId: string): Promise<AttendanceToday> {
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('attendance_records')
      .select('status, attendance_date, marked_at')
      .eq('student_id', studentId)
      .eq('attendance_date', today)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') throw error

    if (!data) {
      return {
        status: 'not_marked',
        date: today
      }
    }

    return {
      status: data.status,
      date: data.attendance_date,
      marked_at: data.marked_at
    }
  }

  /**
   * Get fee status summary for a student
   */
  async getFeeStatus(studentId: string): Promise<FeeStatus> {
    const today = new Date().toISOString().split('T')[0]

    // Get all unpaid student fees
    const { data: invoices, error } = await supabase
      .from('student_fees')
      .select('final_amount, balance, due_date, status')
      .eq('student_id', studentId)
      .in('status', ['pending', 'partial', 'overdue'])
      .order('due_date', { ascending: true })

    if (error) throw error

    const total_due = (invoices || []).reduce((sum, inv) => sum + parseFloat(inv.balance || inv.final_amount), 0)
    const overdue_amount = (invoices || [])
      .filter(inv => inv.due_date < today)
      .reduce((sum, inv) => sum + parseFloat(inv.balance || inv.final_amount), 0)

    const next_invoice = (invoices || []).find(inv => inv.due_date >= today)

    return {
      total_due,
      overdue_amount,
      next_due_date: next_invoice?.due_date,
      next_due_amount: next_invoice ? parseFloat(next_invoice.balance || next_invoice.final_amount) : undefined,
      unpaid_invoices: (invoices || []).length
    }
  }

  /**
   * Get next upcoming exam for a student
   */
  async getUpcomingExams(studentId: string, limit = 1): Promise<UpcomingExam[]> {
    const today = new Date().toISOString().split('T')[0]

    // Get student's section_id
    const { data: student } = await supabase
      .from('students')
      .select('section_id')
      .eq('id', studentId)
      .single()

    if (!student?.section_id) return []

    const { data: exams, error } = await supabase
      .from('exams')
      .select(`
        id, 
        exam_name, 
        exam_date, 
        max_marks,
        subject:subjects(name)
      `)
      .eq('section_id', student.section_id)
      .gte('exam_date', today)
      .eq('is_published', true)
      .order('exam_date', { ascending: true })
      .limit(limit)

    if (error) {
      console.error('Error fetching upcoming exams:', error)
      return []
    }

    return (exams || []).map(exam => {
      const examDate = new Date(exam.exam_date)
      const todayDate = new Date(today)
      const days_until = Math.ceil((examDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))

      return {
        id: exam.id,
        exam_name: exam.exam_name,
        subject: (exam.subject as any)?.name || 'Unknown',
        date: exam.exam_date,
        total_marks: exam.max_marks,
        days_until
      }
    })
  }

  /**
   * Get most recent grade for a student
   */
  async getRecentGrades(studentId: string, limit = 1): Promise<RecentGrade[]> {
    const { data, error } = await supabase
      .from('exam_results')
      .select(`
        marks_obtained,
        exam:exams!inner(
          exam_name,
          max_marks,
          exam_date,
          exam_type:exam_types(name),
          subject:subjects(name)
        )
      `)
      .eq('student_id', studentId)
      .not('marks_obtained', 'is', null)
      .order('exam(exam_date)', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching recent grades:', error)
      return [] // Return empty array instead of throwing
    }

    return (data || []).map((result: any) => {
      const maxMarks = result.exam?.max_marks || 100
      const percentage = (result.marks_obtained / maxMarks) * 100
      const grade = this.calculateGrade(percentage)

      return {
        subject: result.exam?.subject?.name || 'Unknown Subject',
        marks_obtained: result.marks_obtained,
        total_marks: maxMarks,
        percentage: Math.round(percentage * 10) / 10,
        grade,
        exam_type: result.exam?.exam_type?.name || 'Exam',
        date: result.exam?.exam_date
      }
    })
  }

  /**
   * Get attendance history for a student (last 30 days)
   */
  async getAttendanceHistory(studentId: string, days = 30): Promise<AttendanceRecord[]> {
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('attendance_records')
      .select(`
        attendance_date,
        status,
        marked_by:profiles!attendance_records_marked_by_fkey(first_name, last_name)
      `)
      .eq('student_id', studentId)
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDate)
      .order('attendance_date', { ascending: false })

    if (error) throw error

    return (data || []).map((record: any) => ({
      date: record.attendance_date,
      status: record.status,
      marked_by: record.marked_by ? `${record.marked_by.first_name} ${record.marked_by.last_name}` : undefined
    }))
  }

  /**
   * Get gradebook (current marks across all subjects)
   */
  async getGradebook(studentId: string): Promise<GradebookEntry[]> {
    // Get student's section_id
    const { data: student } = await supabase
      .from('students')
      .select('section_id, school_id')
      .eq('id', studentId)
      .single()

    if (!student?.section_id) return []

    // Get all subjects for this school
    const { data: subjects } = await supabase
      .from('subjects')
      .select('id, name')
      .eq('school_id', student.school_id)

    if (!subjects || subjects.length === 0) return []

    // For each subject, get total marks from exams
    const gradebook = await Promise.all(
      subjects.map(async (subject) => {
        const { data: results } = await supabase
          .from('exam_results')
          .select(`
            marks_obtained,
            exam:exams!inner(
              max_marks,
              subject_id
            )
          `)
          .eq('student_id', studentId)
          .eq('exam.subject_id', subject.id)

        const totalMarks = (results || []).reduce((sum, r: any) => sum + (r.exam?.max_marks || 0), 0)
        const obtainedMarks = (results || []).reduce((sum, r: any) => sum + (r.marks_obtained || 0), 0)
        const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0

        // Get assignment stats - using section_id
        const { count: assignmentsTotal } = await supabase
          .from('assignments')
          .select('*', { count: 'exact', head: true })
          .eq('subject_id', subject.id)
          .eq('section_id', student.section_id)

        const { count: assignmentsSubmitted } = await supabase
          .from('assignment_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', studentId)

        return {
          subject: subject.name,
          current_marks: Math.round(obtainedMarks),
          total_marks: totalMarks,
          percentage: Math.round(percentage * 10) / 10,
          grade: this.calculateGrade(percentage),
          assignments_submitted: assignmentsSubmitted || 0,
          assignments_total: assignmentsTotal || 0
        }
      })
    )

    return gradebook.filter(g => g.total_marks > 0)
  }

  /**
   * Get homework/assignments diary for a student
   */
  async getHomeworkDiary(studentId: string, days = 7): Promise<HomeworkAssignment[]> {
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Get student's section_id
    const { data: student } = await supabase
      .from('students')
      .select('section_id')
      .eq('id', studentId)
      .single()

    if (!student?.section_id) return []

    const { data: assignments, error } = await supabase
      .from('assignments')
      .select(`
        id,
        title,
        description,
        due_date,
        created_at,
        subject:subjects(name),
        teacher:staff!assignments_teacher_id_fkey(
          profile:profiles!staff_profile_id_fkey(first_name, last_name)
        )
      `)
      .eq('section_id', student.section_id)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching homework:', error)
      return []
    }

    // Check submission status for each assignment
    const homeworkList = await Promise.all(
      (assignments || []).map(async (assignment: any) => {
        const { data: submission } = await supabase
          .from('assignment_submissions')
          .select('submitted_at')
          .eq('assignment_id', assignment.id)
          .eq('student_id', studentId)
          .maybeSingle()

        const today = new Date().toISOString().split('T')[0]
        const status: 'pending' | 'submitted' | 'overdue' = submission 
          ? 'submitted' 
          : (assignment.due_date < today ? 'overdue' : 'pending')

        return {
          id: assignment.id,
          subject: assignment.subject?.name || 'Unknown',
          title: assignment.title,
          description: assignment.description,
          due_date: assignment.due_date,
          assigned_date: assignment.created_at?.split('T')[0],
          status,
          submission_date: submission?.submitted_at,
          teacher_name: assignment.teacher?.profile 
            ? `${assignment.teacher.profile.first_name} ${assignment.teacher.profile.last_name}`
            : 'Unknown'
        }
      })
    )

    return homeworkList
  }

  /**
   * Get consolidated dashboard data (optimized single call)
   */
  async getDashboardData(parentId: string, studentId: string): Promise<DashboardData> {
    // Get student info
    const students = await this.getStudentsList(parentId)
    const student = students.find(s => s.id === studentId)
    
    if (!student) {
      throw new Error('Student not found or not linked to this parent')
    }

    // Fetch all data in parallel for performance
    const [
      attendance_today,
      fee_status,
      upcoming_exams,
      recent_grades
    ] = await Promise.all([
      this.getAttendanceToday(studentId),
      this.getFeeStatus(studentId),
      this.getUpcomingExams(studentId, 1),
      this.getRecentGrades(studentId, 1)
    ])

    return {
      student,
      attendance_today,
      fee_status,
      upcoming_exam: upcoming_exams[0] || null,
      recent_grade: recent_grades[0] || null
    }
  }

  /**
   * Get timetable for a student's section
   */
  async getTimetable(studentId: string): Promise<any[]> {
    // Get student's section_id and school_id
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select(`
        section_id,
        school_id
      `)
      .eq('id', studentId)
      .single()

    if (studentError || !student || !student.section_id) {
      return []
    }

    // Get main school ID (handles campus hierarchy - academic years are on main school)
    const { data: school } = await supabase
      .from('schools')
      .select('id, parent_school_id')
      .eq('id', student.school_id)
      .single()
    
    const mainSchoolId = school?.parent_school_id || student.school_id

    // Get current academic year from main school
    const { data: academicYear, error: academicYearError } = await supabase
      .from('academic_years')
      .select('id')
      .eq('school_id', mainSchoolId)
      .eq('is_current', true)
      .maybeSingle()

    if (academicYearError || !academicYear) {
      return []
    }

    const { data: entries, error } = await supabase
      .from('timetable_entries')
      .select(`
        id,
        day_of_week,
        section:sections(id, name, grade_level:grade_levels(name)),
        subject:subjects(id, name, code),
        teacher:staff!teacher_id(id, profile:profiles!staff_profile_id_fkey(first_name, last_name)),
        period:periods(id, period_number, period_name, start_time, end_time, is_break),
        room_number
      `)
      .eq('section_id', student.section_id)
      .eq('academic_year_id', academicYear.id)
      .eq('is_active', true)
      .order('day_of_week', { ascending: true })

    if (error) throw error

    return (entries || []).map((entry: any) => ({
      id: entry.id,
      day_of_week: entry.day_of_week,
      subject_name: entry.subject?.name || 'N/A',
      subject_code: entry.subject?.code,
      teacher_name: entry.teacher?.profile
        ? `${entry.teacher.profile.first_name} ${entry.teacher.profile.last_name}`.trim()
        : 'Unassigned',
      period_number: entry.period?.period_number,
      period_name: entry.period?.period_name,
      start_time: entry.period?.start_time,
      end_time: entry.period?.end_time,
      is_break: entry.period?.is_break || false,
      room_number: entry.room_number || 'TBD'
    }))
  }

  /**
   * Get subject-wise monthly attendance summary
   */
  async getSubjectWiseAttendance(studentId: string, month?: string): Promise<any> {
    // Default to current month
    const targetMonth = month || new Date().toISOString().slice(0, 7)
    const startDate = `${targetMonth}-01`
    const endDate = new Date(targetMonth + '-01')
    endDate.setMonth(endDate.getMonth() + 1)
    endDate.setDate(0)
    const endDateStr = endDate.toISOString().split('T')[0]

    // Get student's section_id
    const { data: student } = await supabase
      .from('students')
      .select('section_id')
      .eq('id', studentId)
      .single()

    if (!student?.section_id) {
      return { month: targetMonth, subjects: [], overall: {} }
    }

    // Get attendance records with timetable_entry details
    const { data: records, error } = await supabase
      .from('attendance_records')
      .select(`
        attendance_date,
        status,
        timetable_entry:timetable_entries!attendance_records_timetable_entry_id_fkey(
          subject:subjects(name)
        )
      `)
      .eq('student_id', studentId)
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDateStr)

    if (error) throw error

    // Group by subject
    const subjectAttendance: Record<string, { present: number; absent: number; late: number; excused: number; total: number }> = {}
    let overallPresent = 0
    let overallAbsent = 0
    let overallLate = 0
    let overallExcused = 0
    let overallTotal = 0

    for (const record of records || []) {
      const subjectName = (record.timetable_entry as any)?.subject?.name || 'General'
      
      if (!subjectAttendance[subjectName]) {
        subjectAttendance[subjectName] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 }
      }

      subjectAttendance[subjectName].total++
      overallTotal++

      switch (record.status) {
        case 'present':
          subjectAttendance[subjectName].present++
          overallPresent++
          break
        case 'absent':
          subjectAttendance[subjectName].absent++
          overallAbsent++
          break
        case 'late':
          subjectAttendance[subjectName].late++
          overallLate++
          break
        case 'excused':
          subjectAttendance[subjectName].excused++
          overallExcused++
          break
      }
    }

    // Calculate percentages
    const subjects = Object.entries(subjectAttendance).map(([name, stats]) => ({
      subject: name,
      ...stats,
      attendance_rate: stats.total > 0 ? Math.round(((stats.present + stats.excused) / stats.total) * 100) : 0
    }))

    return {
      month: targetMonth,
      subjects,
      overall: {
        present: overallPresent,
        absent: overallAbsent,
        late: overallLate,
        excused: overallExcused,
        total: overallTotal,
        attendance_rate: overallTotal > 0 ? Math.round(((overallPresent + overallExcused) / overallTotal) * 100) : 0
      }
    }
  }

  /**
   * Get detailed attendance records for a specific subject
   */
  async getDetailedAttendance(studentId: string, month?: number, year?: number, subjectId?: string): Promise<any[]> {
    const targetMonth = month || (new Date().getMonth() + 1)
    const targetYear = year || new Date().getFullYear()
    
    const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`
    const endDate = new Date(targetYear, targetMonth, 0) // Last day of month
    const endDateStr = endDate.toISOString().split('T')[0]

    let query = supabase
      .from('attendance_records')
      .select(`
        id,
        attendance_date,
        status,
        timetable_entry:timetable_entries!attendance_records_timetable_entry_id_fkey(
          room_number,
          subject:subjects(id, name, code),
          period:periods(period_number, period_name, start_time, end_time)
        )
      `)
      .eq('student_id', studentId)
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDateStr)
      .order('attendance_date', { ascending: false })

    const { data: records, error } = await query

    if (error) throw error

    // Filter by subject name if specified (frontend passes subject name, not ID)
    let filteredRecords = records || []
    if (subjectId) {
      filteredRecords = filteredRecords.filter((r: any) => 
        r.timetable_entry?.subject?.name === subjectId || 
        r.timetable_entry?.subject?.id === subjectId
      )
    }

    return filteredRecords.map((record: any) => ({
      id: record.id,
      attendance_date: record.attendance_date,
      status: record.status,
      timetable_entry: record.timetable_entry ? {
        room_number: record.timetable_entry.room_number,
        subject: record.timetable_entry.subject,
        period: record.timetable_entry.period
      } : null
    }))
  }

  /**
   * Get fee payment history for a student
   */
  async getPaymentHistory(studentId: string): Promise<any[]> {
    // First get student's school_id
    const { data: student } = await supabase
      .from('students')
      .select('school_id')
      .eq('id', studentId)
      .single()

    if (!student) return []

    // Get all fees with payment history
    // fee_structures references fee_category_id for the name
    const { data: fees, error } = await supabase
      .from('student_fees')
      .select(`
        id,
        fee_structure:fee_structures!student_fees_fee_structure_id_fkey(
          id,
          period_type,
          period_name,
          fee_category:fee_categories!fee_structures_fee_category_id_fkey(name)
        ),
        academic_year,
        base_amount,
        final_amount,
        amount_paid,
        balance,
        status,
        due_date,
        created_at
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Get all payments for these fees
    const feeIds = (fees || []).map(f => f.id)
    
    if (feeIds.length === 0) return []

    const { data: payments, error: paymentsError } = await supabase
      .from('fee_payments')
      .select(`
        id,
        student_fee_id,
        amount,
        payment_method,
        payment_reference,
        payment_date,
        notes,
        received_by:profiles!fee_payments_received_by_fkey(first_name, last_name)
      `)
      .in('student_fee_id', feeIds)
      .order('payment_date', { ascending: false })

    if (paymentsError) throw paymentsError

    // Map payments to fees
    const paymentsByFeeId: Record<string, any[]> = {}
    for (const payment of payments || []) {
      if (!paymentsByFeeId[payment.student_fee_id]) {
        paymentsByFeeId[payment.student_fee_id] = []
      }
      paymentsByFeeId[payment.student_fee_id].push({
        id: payment.id,
        amount: payment.amount,
        payment_method: payment.payment_method,
        payment_reference: payment.payment_reference,
        payment_date: payment.payment_date,
        notes: payment.notes,
        received_by: payment.received_by 
          ? `${payment.received_by.first_name} ${payment.received_by.last_name}`
          : null
      })
    }

    return (fees || []).map(fee => {
      const feeStructure = fee.fee_structure as any
      const categoryName = feeStructure?.fee_category?.name || 'Uncategorized'
      const periodName = feeStructure?.period_name || feeStructure?.period_type || ''
      const feeName = periodName ? `${categoryName} - ${periodName}` : categoryName
      
      return {
        id: fee.id,
        fee_name: feeName,
        category: categoryName,
        academic_year: fee.academic_year,
        base_amount: fee.base_amount,
        final_amount: fee.final_amount,
        amount_paid: fee.amount_paid,
        balance: fee.balance,
        status: fee.status,
        due_date: fee.due_date,
        payments: paymentsByFeeId[fee.id] || []
      }
    })
  }

  /**
   * Get student ID card data
   */
  async getStudentIdCard(studentId: string): Promise<any> {
    // Get student details
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select(`
        id,
        student_number,
        school_id,
        profile:profiles!students_profile_id_fkey(
          first_name,
          last_name,
          profile_photo_url,
          date_of_birth,
          email
        ),
        grade_level,
        section_id,
        sections(name),
        school:schools!students_school_id_fkey(
          name,
          address,
          phone,
          email,
          logo_url
        )
      `)
      .eq('id', studentId)
      .single()

    if (studentError || !student) {
      console.error('Error fetching student for ID card:', studentError)
      throw new Error('Student not found')
    }

    // Note: id_card_templates table doesn't exist yet, return student data only
    let template = null

    // Build token replacement map
    const profile = student.profile as any
    const school = student.school as any
    const section = student.sections as any
    
    const tokenMap: Record<string, string> = {
      '{{student_name}}': `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
      '{{first_name}}': profile?.first_name || '',
      '{{last_name}}': profile?.last_name || '',
      '{{student_number}}': student.student_number || '',
      '{{grade_level}}': student.grade_level || '',
      '{{section}}': section?.name || '',
      '{{date_of_birth}}': profile?.date_of_birth || '',
      '{{email}}': profile?.email || '',
      '{{school_name}}': school?.name || '',
      '{{school_address}}': school?.address || '',
      '{{school_phone}}': school?.phone || '',
      '{{school_email}}': school?.email || '',
      '{{photo}}': profile?.profile_photo_url || '/default-avatar.png',
      '{{school_logo}}': school?.logo_url || ''
    }

    // If no template, return basic data
    if (!template) {
      return {
        student_data: tokenMap,
        template: null
      }
    }

    // Replace tokens in template config
    const templateConfig = template.template_config
    const processedFields = templateConfig.fields?.map((field: any) => {
      let token = field.token
      for (const [key, value] of Object.entries(tokenMap)) {
        if (token === key) {
          token = value
          break
        }
      }
      return { ...field, token }
    })

    // Process QR code data
    let qrData = templateConfig.qrCode?.data || ''
    for (const [key, value] of Object.entries(tokenMap)) {
      qrData = qrData.replace(key, value)
    }

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      template_config: {
        ...templateConfig,
        fields: processedFields,
        qrCode: templateConfig.qrCode ? {
          ...templateConfig.qrCode,
          data: qrData
        } : undefined
      },
      student_data: tokenMap
    }
  }

  /**
   * Get report card / consolidated grades for download
   */
  async getReportCard(studentId: string, academicYear?: string): Promise<any> {
    // Get student details
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select(`
        id,
        student_number,
        profile:profiles!students_profile_id_fkey(first_name, last_name),
        grade_level,
        sections(name, academic_year_id),
        school:schools!students_school_id_fkey(name)
      `)
      .eq('id', studentId)
      .single()

    if (studentError || !student) {
      throw new Error('Student not found')
    }

    const profile = student.profile as any
    const section = student.sections as any
    const school = student.school as any

    // Get all exam results for this student
    const { data: results, error: resultsError } = await supabase
      .from('exam_results')
      .select(`
        marks_obtained,
        exam:exams!inner(
          id,
          exam_name,
          max_marks,
          exam_date,
          exam_type:exam_types(name),
          subject:subjects(name)
        )
      `)
      .eq('student_id', studentId)
      .not('marks_obtained', 'is', null)
      .order('exam(exam_date)', { ascending: true })

    if (resultsError) {
      console.error('Error fetching exam results:', resultsError)
      // Return empty report instead of throwing
      return {
        student: {
          name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
          student_number: student.student_number,
          grade_level: student.grade_level,
          section: section?.name,
          school_name: school?.name
        },
        subjects: [],
        overall: {
          total_obtained: 0,
          total_possible: 0,
          percentage: 0,
          grade: 'N/A'
        },
        generated_at: new Date().toISOString()
      }
    }

    // Group by subject and exam type
    const subjectResults: Record<string, {
      subject: string
      exams: { exam_name: string; exam_type: string; marks_obtained: number; total_marks: number; date: string }[]
      total_obtained: number
      total_possible: number
    }> = {}

    for (const result of results || []) {
      const exam = result.exam as any
      const subjectName = exam?.subject?.name || 'Unknown'

      if (!subjectResults[subjectName]) {
        subjectResults[subjectName] = {
          subject: subjectName,
          exams: [],
          total_obtained: 0,
          total_possible: 0
        }
      }

      subjectResults[subjectName].exams.push({
        exam_name: exam.exam_name,
        exam_type: exam?.exam_type?.name || 'Exam',
        marks_obtained: result.marks_obtained,
        total_marks: exam.max_marks || 100,
        date: exam.exam_date
      })

      subjectResults[subjectName].total_obtained += result.marks_obtained
      subjectResults[subjectName].total_possible += (exam.max_marks || 100)
    }

    // Calculate grades and totals
    const subjects = Object.values(subjectResults).map(s => ({
      ...s,
      percentage: s.total_possible > 0 ? Math.round((s.total_obtained / s.total_possible) * 100 * 10) / 10 : 0,
      grade: this.calculateGrade(s.total_possible > 0 ? (s.total_obtained / s.total_possible) * 100 : 0)
    }))

    const overallObtained = subjects.reduce((sum, s) => sum + s.total_obtained, 0)
    const overallPossible = subjects.reduce((sum, s) => sum + s.total_possible, 0)
    const overallPercentage = overallPossible > 0 ? Math.round((overallObtained / overallPossible) * 100 * 10) / 10 : 0

    return {
      student: {
        name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
        student_number: student.student_number,
        grade_level: student.grade_level,
        section: section?.name,
        school_name: school?.name
      },
      subjects,
      overall: {
        total_obtained: overallObtained,
        total_possible: overallPossible,
        percentage: overallPercentage,
        grade: this.calculateGrade(overallPercentage)
      },
      generated_at: new Date().toISOString()
    }
  }

  /**
   * Helper: Calculate letter grade from percentage
   */
  private calculateGrade(percentage: number): string {
    if (percentage >= 90) return 'A+'
    if (percentage >= 85) return 'A'
    if (percentage >= 80) return 'B+'
    if (percentage >= 75) return 'B'
    if (percentage >= 70) return 'C+'
    if (percentage >= 65) return 'C'
    if (percentage >= 60) return 'D'
    return 'F'
  }
}

export const parentDashboardService = new ParentDashboardService()
