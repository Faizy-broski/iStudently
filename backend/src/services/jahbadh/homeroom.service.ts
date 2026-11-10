import { supabase } from '../../config/supabase'
import { SAFE_PROFILE_COLUMNS } from '../../utils/profile-columns'
import { logJgAudit } from './audit.service'

/**
 * Homeroom teachers («رائد الفصل», brief B9 grades.view_section): one staff member per section and
 * academic year. They see every subject of their section (grids, results, report cards) read-only,
 * and keep the homeroom data (activities, daily attendance) like the section's teachers.
 * Admins assign them. Before jahbadh_wave2_data.sql runs the table is missing: nobody is homeroom.
 */

const missingTable = (e: any) => e && (e.code === 'PGRST205' || e.code === '42P01')

/** True when the staff member is the section's homeroom teacher for that academic year. */
export async function isHomeroomTeacher(sectionId: string, academicYearId: string, staffId: string | null | undefined): Promise<boolean> {
  if (!staffId) return false
  const { data, error } = await supabase
    .from('jg_homeroom_teachers')
    .select('id')
    .eq('section_id', sectionId)
    .eq('academic_year_id', academicYearId)
    .eq('staff_id', staffId)
    .maybeSingle()
  if (missingTable(error)) return false
  if (error) throw error
  return !!data
}

/** Sections the staff member is homeroom teacher of, in the current academic year. */
export async function homeroomSectionIds(staffId: string | null | undefined): Promise<string[]> {
  if (!staffId) return []
  const { data, error } = await supabase
    .from('jg_homeroom_teachers')
    .select('section_id, academic_year:academic_years!inner(is_current)')
    .eq('staff_id', staffId)
    .eq('academic_year.is_current', true)
  if (missingTable(error)) return []
  if (error) throw error
  return [...new Set((data ?? []).map((r: any) => r.section_id))]
}

export interface JgHomeroom {
  section_id: string
  academic_year_id: string
  staff_id: string | null
  name: string | null
}

const staffName = (p: any) => [p?.first_name, p?.father_name, p?.last_name].filter(Boolean).join(' ') || null

export async function getHomeroom(sectionId: string, academicYearId: string): Promise<JgHomeroom> {
  const { data, error } = await supabase
    .from('jg_homeroom_teachers')
    .select(`staff_id, staff:staff(profile:profiles(${SAFE_PROFILE_COLUMNS}))`)
    .eq('section_id', sectionId)
    .eq('academic_year_id', academicYearId)
    .maybeSingle()
  if (missingTable(error)) return { section_id: sectionId, academic_year_id: academicYearId, staff_id: null, name: null }
  if (error) throw error
  const st: any = Array.isArray((data as any)?.staff) ? (data as any).staff[0] : (data as any)?.staff
  const p = Array.isArray(st?.profile) ? st.profile[0] : st?.profile
  return { section_id: sectionId, academic_year_id: academicYearId, staff_id: (data as any)?.staff_id ?? null, name: staffName(p) }
}

/** Assigns (or clears, with null) the section's homeroom teacher. The staff member must be in the school family. */
export async function setHomeroom(
  ctx: { section: { id: string; school_id: string }; rootId: string; yearId: string },
  staffId: string | null,
  actor: { profileId: string; role: string },
  staffInFamily: (staffId: string) => Promise<boolean>,
): Promise<JgHomeroom> {
  const before = await getHomeroom(ctx.section.id, ctx.yearId)
  if (staffId === null) {
    const { error } = await supabase.from('jg_homeroom_teachers').delete().eq('section_id', ctx.section.id).eq('academic_year_id', ctx.yearId)
    if (error) throw error
  } else {
    if (!(await staffInFamily(staffId))) {
      const { JgError } = await import('./grades.service')
      throw new JgError(400, 'This staff member is not in this school', 'invalid_staff')
    }
    const { error } = await supabase.from('jg_homeroom_teachers').upsert(
      { school_id: ctx.section.school_id, academic_year_id: ctx.yearId, section_id: ctx.section.id, staff_id: staffId, updated_by: actor.profileId, updated_at: new Date().toISOString() },
      { onConflict: 'section_id,academic_year_id' },
    )
    if (error) throw error
  }
  await logJgAudit({
    schoolId: ctx.rootId, actorId: actor.profileId, actorRole: actor.role, action: 'homeroom.update', entity: 'jg_homeroom_teachers',
    sectionId: ctx.section.id, before: { staff_id: before.staff_id }, after: { staff_id: staffId },
  })
  return getHomeroom(ctx.section.id, ctx.yearId)
}
