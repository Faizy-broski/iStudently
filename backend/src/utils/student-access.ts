import { supabase } from '../config/supabase'
import type { AuthRequest } from '../middlewares/auth.middleware'
import { campusIdsAllowed } from './campus-validation'

type Caller = Pick<AuthRequest, 'profile'>

/**
 * May the caller read this student's records (grades, transcript, breakdown)?
 * super admin: any. student: only themselves. parent: only actively linked children.
 * Every other role (admin, teacher, staff, ...): students of their own school family.
 */
export async function canViewStudent(req: Caller, studentId: string): Promise<boolean> {
  const profile = req.profile
  if (!profile || !studentId) return false
  if (profile.role === 'super_admin') return true
  if (profile.role === 'student') return (profile.student_id || profile.id) === studentId
  if (profile.role === 'parent') {
    const { data } = await supabase
      .from('parent_student_links')
      .select('id, parent:parents!inner(profile_id)')
      .eq('student_id', studentId)
      .eq('is_active', true)
      .eq('parent.profile_id', profile.id)
      .limit(1)
    return !!data && data.length > 0
  }
  const { data } = await supabase.from('students').select('school_id').eq('id', studentId).maybeSingle()
  return !!data?.school_id && campusIdsAllowed(profile.school_id, [data.school_id])
}

/**
 * May the caller read a whole class (course period) of grades? Students and parents never;
 * other roles only course periods of their own school family.
 */
export async function canViewCoursePeriod(req: Caller, coursePeriodId: string): Promise<boolean> {
  const profile = req.profile
  if (!profile || !coursePeriodId) return false
  if (profile.role === 'super_admin') return true
  if (profile.role === 'student' || profile.role === 'parent') return false
  const { data } = await supabase.from('course_periods').select('school_id, campus_id').eq('id', coursePeriodId).maybeSingle()
  if (!data) return false
  const ids = [data.school_id, data.campus_id].filter((x): x is string => !!x)
  return ids.length > 0 && campusIdsAllowed(profile.school_id, ids)
}

/**
 * May the caller read the class list (names of enrolled students) of this course period?
 * Students only for classes they are enrolled in, parents only for their linked children's classes.
 * Other roles pass (the row-school-scope middleware limits them to their school family).
 */
export async function canViewClassList(req: Caller, coursePeriodId: string): Promise<boolean> {
  const profile = req.profile
  if (!profile || !coursePeriodId) return false
  if (profile.role !== 'student' && profile.role !== 'parent') return true
  let studentIds: string[] = []
  if (profile.role === 'student') {
    studentIds = [profile.student_id || profile.id]
  } else {
    const { data } = await supabase
      .from('parent_student_links')
      .select('student_id, parent:parents!inner(profile_id)')
      .eq('is_active', true)
      .eq('parent.profile_id', profile.id)
    studentIds = (data ?? []).map((r: { student_id: string }) => r.student_id)
  }
  if (!studentIds.length) return false
  const { data } = await supabase.from('student_schedules').select('id').eq('course_period_id', coursePeriodId).in('student_id', studentIds).limit(1)
  return !!data && data.length > 0
}

/** Does the teacher teach a course period in this section (staff_id = the signed-in teacher)? */
export async function teachesSection(req: Caller, sectionId: string): Promise<boolean> {
  const staffId = (req.profile as { staff_id?: string | null } | undefined)?.staff_id
  if (!staffId || !sectionId) return false
  const { data } = await supabase.from('course_periods').select('id').eq('section_id', sectionId).eq('teacher_id', staffId).limit(1)
  return !!data && data.length > 0
}
