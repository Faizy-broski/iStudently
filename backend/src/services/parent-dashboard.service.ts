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

    // Get student's grade and section
    const { data: student } = await supabase
      .from('students')
      .select('grade_level, section')
      .eq('id', studentId)
      .single()

    if (!student) return []

    const { data: exams, error } = await supabase
      .from('exams')
      .select('id, exam_name, subject, date, time, total_marks')
      .eq('grade_level', student.grade_level)
      .eq('section', student.section)
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(limit)

    if (error) throw error

    return (exams || []).map(exam => {
      const examDate = new Date(exam.date)
      const todayDate = new Date(today)
      const days_until = Math.ceil((examDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))

      return {
        ...exam,
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
        total_marks,
        exam:exams!inner(
          exam_name,
          subject,
          date,
          exam_type
        )
      `)
      .eq('student_id', studentId)
      .not('marks_obtained', 'is', null)
      .order('exam(date)', { ascending: false })
      .limit(limit)

    if (error) throw error

    return (data || []).map((result: any) => {
      const percentage = (result.marks_obtained / result.total_marks) * 100
      const grade = this.calculateGrade(percentage)

      return {
        subject: result.exam.subject,
        marks_obtained: result.marks_obtained,
        total_marks: result.total_marks,
        percentage: Math.round(percentage * 10) / 10,
        grade,
        exam_type: result.exam.exam_type,
        date: result.exam.date
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
    // Get student's current academic year, grade, and section
    const { data: student } = await supabase
      .from('students')
      .select('grade_level, section, school_id')
      .eq('id', studentId)
      .single()

    if (!student) return []

    // Get all subjects for this grade/section
    const { data: subjects } = await supabase
      .from('subjects')
      .select('id, name')
      .eq('school_id', student.school_id)

    if (!subjects) return []

    // For each subject, get total marks from exams
    const gradebook = await Promise.all(
      subjects.map(async (subject) => {
        const { data: results } = await supabase
          .from('exam_results')
          .select(`
            marks_obtained,
            exam:exams!inner(total_marks, subject)
          `)
          .eq('student_id', studentId)
          .eq('exam.subject', subject.name)

        const totalMarks = (results || []).reduce((sum, r: any) => sum + r.exam.total_marks, 0)
        const obtainedMarks = (results || []).reduce((sum, r: any) => sum + (r.marks_obtained || 0), 0)
        const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0

        // Get assignment stats
        const { count: assignmentsTotal } = await supabase
          .from('assignments')
          .select('*', { count: 'exact', head: true })
          .eq('subject', subject.name)
          .eq('grade_level', student.grade_level)

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

    // Get student's grade and section
    const { data: student } = await supabase
      .from('students')
      .select('grade_level, section')
      .eq('id', studentId)
      .single()

    if (!student) return []

    const { data: assignments, error } = await supabase
      .from('assignments')
      .select(`
        id,
        subject,
        title,
        description,
        due_date,
        assigned_date,
        teacher:staff!assignments_created_by_fkey(
          profile:profiles!staff_profile_id_fkey(first_name, last_name)
        )
      `)
      .eq('grade_level', student.grade_level)
      .eq('section', student.section)
      .gte('assigned_date', startDate)
      .lte('assigned_date', endDate)
      .order('assigned_date', { ascending: false })

    if (error) throw error

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
          subject: assignment.subject,
          title: assignment.title,
          description: assignment.description,
          due_date: assignment.due_date,
          assigned_date: assignment.assigned_date,
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
