import { supabase } from '../../config/supabase'
import { getAllCampusIds, isCampus } from '../../utils/school-helpers'

// ============================================================================
// Hifzi circles — the study-group/halaqah entity. Campus-scoping mirrors
// backend/src/services/library.service.ts exactly: an admin at the parent
// (org) school sees circles across every campus; a campus-scoped role
// (teacher, campus admin) sees only their own campus's circles.
// ============================================================================

export interface CircleScheduleInput {
  dayOfWeek: number
  startTime: string
  endTime: string
  location?: string
}

export interface CreateCircleDTO {
  nameAr: string
  nameEn?: string
  riwayahId: string
  sectionGender?: 'male' | 'female' | 'mixed'
  circleType?: string
  capacity?: number
}

class CirclesService {
  /**
   * Resolves the set of school/campus IDs to query. Same convention as
   * library.service.ts's private resolveSchoolIds (and now
   * textbook-deliveries.service.ts's): an explicit campusId always wins and
   * scopes to just that campus; otherwise an admin at the parent (org)
   * school sees circles aggregated across every campus; a campus-scoped
   * role (teacher, campus admin) sees only their own campus's circles.
   *
   * Previously this service only ever used the caller's raw schoolId with
   * no way to scope to one specific campus, and createCircle/updateCircle
   * always wrote under `schoolId` regardless of which campus was selected
   * in the frontend's CampusContext — harmless for an org-level admin
   * (whose own schoolId is the parent, already included in the "show all"
   * aggregate), but wrong for a campus-scoped admin creating/editing a
   * circle meant for a specific campus. Fixed to accept an explicit
   * campusId end-to-end, matching every other campus-aware controller in
   * this codebase (e.g. teacher.controller.ts's `campus_id || school_id`
   * resolution, and this module's own hifzi-enabled.middleware.ts).
   */
  private async resolveSchoolIds(schoolId: string, userRole?: string, campusId?: string): Promise<string[]> {
    if (campusId) return [campusId]
    const isParentSchool = !(await isCampus(schoolId))
    if ((userRole === 'admin' || userRole === 'super_admin') && isParentSchool) {
      return getAllCampusIds(schoolId)
    }
    return [schoolId]
  }

  async getCircles(schoolId: string, userRole?: string, campusId?: string) {
    const schoolIds = await this.resolveSchoolIds(schoolId, userRole, campusId)

    const { data, error } = await supabase
      .from('hifzi_circles')
      .select('*, hifzi_circle_teachers(id, teacher_profile_id, role, active_to), hifzi_circle_schedules(*)')
      .eq('is_active', true)
      .in('school_id', schoolIds)
      .order('name_ar')

    if (error) throw new Error(`Failed to fetch circles: ${error.message}`)
    return data || []
  }

  async getCircleById(circleId: string, schoolId: string, campusId?: string) {
    const { data, error } = await supabase
      .from('hifzi_circles')
      .select('*, hifzi_circle_teachers(id, teacher_profile_id, role, active_to), hifzi_circle_schedules(*)')
      .eq('id', circleId)
      .eq('school_id', campusId || schoolId)
      .single()

    if (error) throw new Error(`Circle not found: ${error.message}`)
    return data
  }

  async createCircle(dto: CreateCircleDTO, schoolId: string, createdBy?: string, campusId?: string) {
    const insertPayload = {
      school_id: campusId || schoolId,
      name_ar: dto.nameAr,
      name_en: dto.nameEn ?? null,
      riwayah_id: dto.riwayahId,
      section_gender: dto.sectionGender ?? 'mixed',
      circle_type: dto.circleType ?? 'halaqah',
      capacity: dto.capacity ?? null,
      created_by: createdBy ?? null,
    }
    const { data, error } = await supabase.from('hifzi_circles').insert(insertPayload).select().single()

    if (error) throw new Error(`Failed to create circle: ${error.message}`)
    return data
  }

  async updateCircle(circleId: string, schoolId: string, updates: Partial<CreateCircleDTO> & { isActive?: boolean }, campusId?: string) {
    const payload: Record<string, any> = { updated_at: new Date().toISOString() }
    if (updates.nameAr !== undefined) payload.name_ar = updates.nameAr
    if (updates.nameEn !== undefined) payload.name_en = updates.nameEn
    if (updates.riwayahId !== undefined) payload.riwayah_id = updates.riwayahId
    if (updates.sectionGender !== undefined) payload.section_gender = updates.sectionGender
    if (updates.circleType !== undefined) payload.circle_type = updates.circleType
    if (updates.capacity !== undefined) payload.capacity = updates.capacity
    if (updates.isActive !== undefined) payload.is_active = updates.isActive

    const { data, error } = await supabase
      .from('hifzi_circles')
      .update(payload)
      .eq('id', circleId)
      .eq('school_id', campusId || schoolId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update circle: ${error.message}`)
    return data
  }

  async addTeacher(circleId: string, teacherProfileId: string, role: 'lead' | 'assistant' | 'substitute' = 'lead') {
    const { data, error } = await supabase
      .from('hifzi_circle_teachers')
      .insert({ circle_id: circleId, teacher_profile_id: teacherProfileId, role })
      .select()
      .single()

    if (error) throw new Error(`Failed to add teacher to circle: ${error.message}`)
    return data
  }

  async removeTeacher(circleId: string, teacherProfileId: string) {
    const { error } = await supabase
      .from('hifzi_circle_teachers')
      .update({ active_to: new Date().toISOString().slice(0, 10) })
      .eq('circle_id', circleId)
      .eq('teacher_profile_id', teacherProfileId)
      .is('active_to', null)

    if (error) throw new Error(`Failed to remove teacher from circle: ${error.message}`)
    return { success: true }
  }

  async addSchedule(circleId: string, schedule: CircleScheduleInput) {
    if (schedule.endTime <= schedule.startTime) {
      throw new Error('Schedule end time must be after start time')
    }

    const { data, error } = await supabase
      .from('hifzi_circle_schedules')
      .insert({
        circle_id: circleId,
        day_of_week: schedule.dayOfWeek,
        start_time: schedule.startTime,
        end_time: schedule.endTime,
        location: schedule.location ?? null,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to add circle schedule: ${error.message}`)
    return data
  }

  /**
   * Conflict detection (spec HFZ-CIR-5): does adding this schedule slot
   * double-book any of this circle's teachers into another circle at an
   * overlapping day/time? Room double-booking isn't checked here since
   * `location` is freeform text, not a Room FK — worth revisiting if Hifzi
   * later shares the platform's structured Room entity.
   */
  async getScheduleConflicts(circleId: string, schoolId: string, schedule: CircleScheduleInput) {
    const { data: teacherRows } = await supabase
      .from('hifzi_circle_teachers')
      .select('teacher_profile_id')
      .eq('circle_id', circleId)
      .is('active_to', null)

    const teacherIds = (teacherRows || []).map((t) => t.teacher_profile_id)
    if (teacherIds.length === 0) return []

    const { data: overlaps, error } = await supabase
      .from('hifzi_circle_schedules')
      .select('id, circle_id, day_of_week, start_time, end_time, hifzi_circles!inner(name_ar, school_id, hifzi_circle_teachers!inner(teacher_profile_id))')
      .eq('day_of_week', schedule.dayOfWeek)
      .eq('is_active', true)
      .neq('circle_id', circleId)
      .in('hifzi_circles.hifzi_circle_teachers.teacher_profile_id', teacherIds)
      .eq('hifzi_circles.school_id', schoolId)
      .lt('start_time', schedule.endTime)
      .gt('end_time', schedule.startTime)

    if (error) {
      console.error('getScheduleConflicts query error:', error)
      return []
    }
    return overlaps || []
  }
}

export const circlesService = new CirclesService()
