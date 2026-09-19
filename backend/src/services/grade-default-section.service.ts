import { supabase } from '../config/supabase'

/**
 * A timetable is built per section (timetable_entries.section_id is NOT NULL and
 * attendance, diaries, generation and the student/parent portals all key off it).
 * Many schools have grades with no sections at all (e.g. a single-class grade),
 * so rather than making section_id optional across the whole system, a grade
 * with no sections gets ONE default section named after the grade itself. It is
 * an ordinary section, so every timetable feature works unchanged, and the admin
 * never has to visit Academics first.
 */
export interface EnsureGradeSectionResult {
  section: { id: string; name: string; grade_level_id: string; campus_id: string }
  created: boolean
  studentsAssigned: number
}

export async function ensureDefaultSectionForGrade(params: {
  campusId: string
  gradeLevelId: string
  createdBy?: string
}): Promise<EnsureGradeSectionResult> {
  const { campusId, gradeLevelId, createdBy } = params

  const { data: grade, error: gradeErr } = await supabase
    .from('grade_levels')
    .select('id, name')
    .eq('id', gradeLevelId)
    .eq('campus_id', campusId)
    .maybeSingle()
  if (gradeErr) throw new Error(`Failed to load grade level: ${gradeErr.message}`)
  if (!grade) throw new Error('Grade level not found for this campus')

  const { data: existing, error: existingErr } = await supabase
    .from('sections')
    .select('id, name, grade_level_id, campus_id')
    .eq('grade_level_id', gradeLevelId)
    .eq('campus_id', campusId)
    .order('created_at', { ascending: true })
    .limit(1)
  if (existingErr) throw new Error(`Failed to check sections: ${existingErr.message}`)
  if (existing && existing.length > 0) {
    return { section: existing[0], created: false, studentsAssigned: 0 }
  }

  // Students of this grade with no section yet — they become members of the default
  // section so the timetable shows up in their portals and attendance works.
  const { data: unassigned, error: studentsErr } = await supabase
    .from('students')
    .select('id')
    .eq('school_id', campusId)
    .eq('grade_level_id', gradeLevelId)
    .is('section_id', null)
  if (studentsErr) throw new Error(`Failed to load students: ${studentsErr.message}`)
  const studentIds = (unassigned || []).map((s: any) => s.id as string)

  // Assigning students bumps sections.current_strength and a trigger rejects going
  // over capacity, so size the section to fit everyone with headroom.
  const capacity = Math.max(30, studentIds.length + 10)

  const { data: section, error: createErr } = await supabase
    .from('sections')
    .insert({
      school_id: campusId,
      campus_id: campusId,
      grade_level_id: gradeLevelId,
      name: grade.name,
      capacity,
      created_by: createdBy ?? null,
    })
    .select('id, name, grade_level_id, campus_id')
    .single()
  if (createErr || !section) throw new Error(`Failed to create default section: ${createErr?.message}`)

  let studentsAssigned = 0
  if (studentIds.length > 0) {
    const { error: assignErr } = await supabase
      .from('students')
      .update({ section_id: section.id })
      .in('id', studentIds)
    if (assignErr) {
      console.error('Default section created but assigning students failed:', assignErr)
    } else {
      studentsAssigned = studentIds.length
      // Keep open enrollment rows consistent with the students table (best effort).
      const { error: enrollErr } = await supabase
        .from('student_enrollment')
        .update({ section_id: section.id })
        .in('student_id', studentIds)
        .is('end_date', null)
        .is('section_id', null)
      if (enrollErr) console.error('Failed to sync enrollment section for default section:', enrollErr)
    }
  }

  return { section, created: true, studentsAssigned }
}
