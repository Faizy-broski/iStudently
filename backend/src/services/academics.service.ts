import { supabase } from '../config/supabase'
import { getEffectiveSchoolId } from '../utils/school-helpers'
import {
  GradeLevel,
  Section,
  Subject,
  CreateGradeLevelDTO,
  UpdateGradeLevelDTO,
  CreateSectionDTO,
  UpdateSectionDTO,
  CreateSubjectDTO,
  UpdateSubjectDTO,
  AcademicYear,
  CreateAcademicYearDTO,
  UpdateAcademicYearDTO,
  ApiResponse
} from '../types'

// ============================================================================
// GRADE LEVELS SERVICE
// ============================================================================

export const createGradeLevel = async (data: CreateGradeLevelDTO): Promise<GradeLevel> => {
  const { data: grade, error } = await supabase
    .from('grade_levels')
    .insert({
      school_id: data.school_id,
      campus_id: data.school_id, // campus_id = school_id for campuses
      name: data.name,
      order_index: data.order_index,
      base_fee: data.base_fee,
      created_by: data.created_by,
    })
    .select()
    .single()

  if (error) throw error
  return grade
}

export const getGradeLevels = async (schoolId: string): Promise<GradeLevel[]> => {
  const { data, error } = await supabase.rpc('get_grade_with_stats', {
    p_campus_id: schoolId,
    p_school_id: null,
  })

  if (error) throw error
  return data || []
}

export const getGradeLevelById = async (id: string, schoolId: string): Promise<GradeLevel | null> => {
  // schoolId is actually campus_id in campus-specific setup
  const { data, error } = await supabase
    .from('grade_levels')
    .select('*')
    .eq('id', id)
    .eq('campus_id', schoolId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export const updateGradeLevel = async (
  id: string,
  schoolId: string,
  data: UpdateGradeLevelDTO
): Promise<GradeLevel> => {
  const { data: grade, error } = await supabase
    .from('grade_levels')
    .update(data)
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error) throw error
  if (!grade) throw new Error(`Grade level with ID ${id} not found or access denied`)
  return grade
}

export const deleteGradeLevel = async (id: string, schoolId: string): Promise<void> => {
  // Check if grade has any sections or subjects
  const { data: sections } = await supabase
    .from('sections')
    .select('id')
    .eq('grade_level_id', id)
    .limit(1)

  if (sections && sections.length > 0) {
    throw new Error('Cannot delete grade level with existing sections')
  }

  const { data: subjects } = await supabase
    .from('subjects')
    .select('id')
    .eq('grade_level_id', id)
    .limit(1)

  if (subjects && subjects.length > 0) {
    throw new Error('Cannot delete grade level with existing subjects')
  }

  // schoolId is actually campus_id in campus-specific setup
  const { error } = await supabase
    .from('grade_levels')
    .delete()
    .eq('id', id)
    .eq('campus_id', schoolId)

  if (error) throw error
}

// ============================================================================
// SECTIONS SERVICE
// ============================================================================

export const createSection = async (data: CreateSectionDTO): Promise<Section> => {
  const { data: section, error } = await supabase
    .from('sections')
    .insert({
      school_id: data.school_id,
      campus_id: data.school_id, // campus_id = school_id for campuses
      grade_level_id: data.grade_level_id,
      name: data.name,
      capacity: data.capacity,
      created_by: data.created_by,
    })
    .select(`
      *,
      grade_levels!inner(name)
    `)
    .maybeSingle()

  if (error) throw error
  if (!section) throw new Error('Failed to create section or access denied')

  return {
    ...section,
    grade_name: section.grade_levels?.name,
  }
}

export const getSections = async (schoolId: string, gradeId?: string): Promise<Section[]> => {
  // For now, use campus_id = school_id since campuses ARE schools
  // If gradeId is provided, use get_sections_by_grade, otherwise get all sections for the campus
  if (gradeId) {
    const { data, error } = await supabase.rpc('get_sections_by_grade', {
      p_grade_level_id: gradeId,
      p_campus_id: schoolId, // Changed from p_school_id to p_campus_id
    })
    if (error) throw error
    return data || []
  } else {
    // Get all sections for the campus using the new function
    const { data, error } = await supabase.rpc('get_all_sections_with_campus', {
      p_campus_id: schoolId,
      p_school_id: null,
    })
    if (error) throw error
    return data || []
  }
}

export const getSectionById = async (id: string, schoolId: string): Promise<Section | null> => {
  // schoolId is actually campus_id in campus-specific setup
  const { data, error } = await supabase
    .from('sections')
    .select(`
      *,
      grade_levels!inner(name)
    `)
    .eq('id', id)
    .eq('campus_id', schoolId)
    .single()

  if (error && error.code !== 'PGRST116') throw error

  if (!data) return null

  return {
    ...data,
    grade_name: data.grade_levels?.name,
    available_seats: data.capacity - data.current_strength,
  }
}

export const updateSection = async (
  id: string,
  schoolId: string,
  data: UpdateSectionDTO
): Promise<Section> => {
  // If capacity is being reduced, check if current strength allows it
  if (data.capacity !== undefined) {
    const section = await getSectionById(id, schoolId)
    if (section && data.capacity < section.current_strength) {
      throw new Error(
        `Cannot reduce capacity to ${data.capacity}. Current strength is ${section.current_strength}.`
      )
    }
  }

  const { data: section, error } = await supabase
    .from('sections')
    .update(data)
    .eq('id', id)
    .select(`
      *,
      grade_levels!inner(name)
    `)
    .maybeSingle()

  if (error) throw error
  if (!section) throw new Error(`Section with ID ${id} not found or access denied`)

  return {
    ...section,
    grade_name: section.grade_levels?.name,
    available_seats: section.capacity - section.current_strength,
  }
}

export const deleteSection = async (id: string, schoolId: string): Promise<void> => {
  // Check if section has any students
  const section = await getSectionById(id, schoolId)
  if (section && section.current_strength > 0) {
    throw new Error('Cannot delete section with enrolled students')
  }

  // schoolId is actually campus_id in campus-specific setup
  const { error } = await supabase
    .from('sections')
    .delete()
    .eq('id', id)
    .eq('campus_id', schoolId)

  if (error) throw error
}

// ============================================================================
// SUBJECTS SERVICE
// ============================================================================

export const createSubject = async (data: CreateSubjectDTO): Promise<Subject> => {
  const { data: subject, error } = await supabase
    .from('subjects')
    .insert({
      school_id: data.school_id,
      campus_id: data.school_id, // campus_id = school_id for campuses
      grade_level_id: data.grade_level_id,
      name: data.name,
      code: data.code,
      subject_type: data.subject_type || 'theory',
      created_by: data.created_by,
    })
    .select(`
      *,
      grade_levels!inner(name, order_index)
    `)
    .maybeSingle()

  if (error) throw error
  if (!subject) throw new Error('Failed to create subject or access denied')

  return {
    ...subject,
    grade_name: subject.grade_levels?.name,
    grade_order: subject.grade_levels?.order_index,
  }
}

export const getSubjects = async (schoolId: string, gradeId?: string): Promise<Subject[]> => {
  const { data, error } = await supabase.rpc('get_subjects_by_campus', {
    p_campus_id: schoolId,
    p_grade_level_id: gradeId || null,
  })

  if (error) throw error
  return data || []
}

export const getSubjectById = async (id: string, schoolId: string): Promise<Subject | null> => {
  // schoolId is actually campus_id in campus-specific setup
  const { data, error } = await supabase
    .from('subjects')
    .select(`
      *,
      grade_levels!inner(name, order_index)
    `)
    .eq('id', id)
    .eq('campus_id', schoolId)
    .single()

  if (error && error.code !== 'PGRST116') throw error

  if (!data) return null

  return {
    ...data,
    grade_name: data.grade_levels?.name,
    grade_order: data.grade_levels?.order_index,
  }
}

export const updateSubject = async (
  id: string,
  schoolId: string,
  data: UpdateSubjectDTO
): Promise<Subject> => {
  const { data: subject, error } = await supabase
    .from('subjects')
    .update(data)
    .eq('id', id)
    .select(`
      *,
      grade_levels!inner(name, order_index)
    `)
    .maybeSingle()

  if (error) throw error
  if (!subject) throw new Error(`Subject with ID ${id} not found or access denied`)

  return {
    ...subject,
    grade_name: subject.grade_levels?.name,
    grade_order: subject.grade_levels?.order_index,
  }
}

export const deleteSubject = async (id: string, schoolId: string): Promise<void> => {
  // Note: Add check for teacher assignments when that module is implemented
  // schoolId is actually campus_id in campus-specific setup
  const { error } = await supabase
    .from('subjects')
    .delete()
    .eq('id', id)
    .eq('campus_id', schoolId)

  if (error) throw error
}

// ============================================================================
// ACADEMIC YEAR SERVICE (Global - used across all modules)
// ============================================================================

export const getAcademicYears = async (schoolId: string): Promise<ApiResponse<AcademicYear[]>> => {
  try {
    // Get effective school ID (parent if campus, otherwise the school itself)
    const effectiveSchoolId = await getEffectiveSchoolId(schoolId)

    const { data, error } = await supabase
      .from('academic_years')
      .select('*')
      .eq('school_id', effectiveSchoolId)
      .eq('is_active', true)
      .order('start_date', { ascending: false })

    if (error) throw error

    return {
      success: true,
      data: data as AcademicYear[]
    }
  } catch (error: any) {
    console.error('Error fetching academic years:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const getCurrentAcademicYear = async (
  schoolId: string
): Promise<ApiResponse<AcademicYear>> => {
  try {
    // Get effective school ID (parent if campus, otherwise the school itself)
    const effectiveSchoolId = await getEffectiveSchoolId(schoolId)

    const { data, error } = await supabase
      .from('academic_years')
      .select('*')
      .eq('school_id', effectiveSchoolId)
      .eq('is_current', true)
      .single()

    if (error) throw error

    return {
      success: true,
      data: data as AcademicYear
    }
  } catch (error: any) {
    console.error('Error fetching current academic year:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const createAcademicYear = async (
  dto: CreateAcademicYearDTO
): Promise<ApiResponse<AcademicYear>> => {
  try {
    // If setting as current, unset other current years
    if (dto.is_current) {
      await supabase
        .from('academic_years')
        .update({ is_current: false })
        .eq('school_id', dto.school_id)
        .eq('is_current', true)
    }

    // If setting as next, unset other next years (graceful if column missing)
    if (dto.is_next) {
      const { error: nextErr } = await supabase
        .from('academic_years')
        .update({ is_next: false } as any)
        .eq('school_id', dto.school_id)
        .eq('is_next' as any, true)
      if (nextErr) {
        console.warn('is_next column not available yet, skipping:', nextErr.message)
        delete (dto as any).is_next
      }
    } else {
      // Strip is_next if false to avoid errors when column doesn't exist
      if ('is_next' in dto && !dto.is_next) delete (dto as any).is_next
    }

    const { data, error } = await supabase
      .from('academic_years')
      .insert(dto)
      .select()
      .single()

    if (error) throw error

    // Invalidate cache for this school
    // cache.invalidate(`academic_years:${dto.school_id}`)
    // cache.invalidate(`current_academic_year:${dto.school_id}`)

    return {
      success: true,
      data: data as AcademicYear,
      message: 'Academic year created successfully'
    }
  } catch (error: any) {
    console.error('Error creating academic year:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const updateAcademicYear = async (
  yearId: string,
  dto: UpdateAcademicYearDTO
): Promise<ApiResponse<AcademicYear>> => {
  try {
    // If setting as current, unset other current years
    if (dto.is_current) {
      const { data: year } = await supabase
        .from('academic_years')
        .select('school_id')
        .eq('id', yearId)
        .single()

      if (year) {
        await supabase
          .from('academic_years')
          .update({ is_current: false })
          .eq('school_id', year.school_id)
          .eq('is_current', true)
          .neq('id', yearId)
      }
    }

    // If setting as next, unset other next years (graceful if column missing)
    if (dto.is_next) {
      const { data: year } = await supabase
        .from('academic_years')
        .select('school_id')
        .eq('id', yearId)
        .single()

      if (year) {
        const { error: nextErr } = await supabase
          .from('academic_years')
          .update({ is_next: false } as any)
          .eq('school_id', year.school_id)
          .eq('is_next' as any, true)
          .neq('id', yearId)
        if (nextErr) {
          console.warn('is_next column not available yet, skipping:', nextErr.message)
          delete (dto as any).is_next
        }
      }
    } else if ('is_next' in dto && dto.is_next === false) {
      // Updating is_next to false — test if column exists first
      const { error: probeErr } = await supabase
        .from('academic_years')
        .select('is_next' as any)
        .limit(1)
      if (probeErr) {
        console.warn('is_next column not available yet, stripping from update')
        delete (dto as any).is_next
      }
    }

    const { data, error } = await supabase
      .from('academic_years')
      .update(dto)
      .eq('id', yearId)
      .select()
      .single()

    if (error) throw error

    // Invalidate cache for this school
    if (data) {
      // cache.invalidate(`academic_years:${data.school_id}`)
      // cache.invalidate(`current_academic_year:${data.school_id}`)
    }

    return {
      success: true,
      data: data as AcademicYear,
      message: 'Academic year updated successfully'
    }
  } catch (error: any) {
    console.error('Error updating academic year:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const deleteAcademicYear = async (yearId: string): Promise<ApiResponse<void>> => {
  try {
    const { error } = await supabase
      .from('academic_years')
      .delete()
      .eq('id', yearId)

    if (error) throw error

    return {
      success: true,
      message: 'Academic year deleted successfully'
    }
  } catch (error: any) {
    console.error('Error deleting academic year:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
