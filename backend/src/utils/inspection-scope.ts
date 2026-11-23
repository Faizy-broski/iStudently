import { supabase } from '../config/supabase'

/**
 * Every teacher (and optional subject) named for an inspection visit must belong to the visit's own
 * campus — same rule as the "add teacher to visit" pickers (profiles.school_id / subjects.school_id).
 * Without it an inspector could create evaluations and notifications for arbitrary profile ids.
 */
export async function assertTeachersAndSubjectsInSchool(
  schoolId: string,
  teacherProfileIds: string[],
  subjectIds: Array<string | null | undefined> = []
): Promise<void> {
  const teachers = [...new Set(teacherProfileIds.filter(Boolean))]
  if (teachers.length) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .in('id', teachers)
      .eq('school_id', schoolId)
      .eq('role', 'teacher')
    if (error) throw new Error(`Failed to verify teachers: ${error.message}`)
    if ((data ?? []).length !== teachers.length) throw new Error('Every teacher must belong to the visit\'s campus')
  }
  const subjects = [...new Set(subjectIds.filter((s): s is string => !!s))]
  if (subjects.length) {
    const { data, error } = await supabase.from('subjects').select('id').in('id', subjects).eq('school_id', schoolId)
    if (error) throw new Error(`Failed to verify subjects: ${error.message}`)
    if ((data ?? []).length !== subjects.length) throw new Error('Every subject must belong to the visit\'s campus')
  }
}

/** Long free text (comments, broadcasts, posts, coaching notes) is capped so a client cannot store megabytes per row. */
export function assertMaxLength(value: unknown, max: number, label: string): void {
  if (typeof value === 'string' && value.length > max) throw new Error(`${label} is too long (max ${max} characters)`)
}
