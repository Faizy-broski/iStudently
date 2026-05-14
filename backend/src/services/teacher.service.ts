import { supabase } from '../config/supabase'
import {
  Staff,
  CreateStaffDTO,
  UpdateStaffDTO,
  TeacherSubjectAssignment,
  CreateTeacherAssignmentDTO,
  AcademicYear,
  CreateAcademicYearDTO,
  UpdateAcademicYearDTO,
  Period,
  CreatePeriodDTO,
  UpdatePeriodDTO,
  ApiResponse
} from '../types'

// ============================================================================
// HELPER: Get main school ID (handles campus hierarchy)
// ============================================================================

const getMainSchoolId = async (schoolId: string): Promise<string> => {
  const { data: school } = await supabase
    .from('schools')
    .select('id, parent_school_id')
    .eq('id', schoolId)
    .single()
  
  // If this school has a parent, return the parent (main school)
  // Otherwise, this is already the main school
  return school?.parent_school_id || schoolId
}

// ============================================================================
// STAFF / TEACHER MANAGEMENT
// ============================================================================

export const getAllTeachers = async (
  schoolId: string,
  options?: { page?: number; limit?: number; search?: string; campus_id?: string }
): Promise<ApiResponse<{ data: Staff[], total: number, page: number, totalPages: number }>> => {
  try {
    const page = options?.page || 1
    const limit = options?.limit || 10
    const offset = (page - 1) * limit
    const search = options?.search?.toLowerCase()
    const campus_id = options?.campus_id

    // Build base query
    let query = supabase
      .from('staff')
      .select(`
        *,
        profile:profiles!staff_profile_id_fkey(*),
        grade_level:grade_levels(id, name),
        section:sections(id, name, capacity),
        assigned_subjects:teacher_subject_assignments!teacher_id(
          id,
          is_primary,
          assigned_at,
          subject:subjects(id, name, code),
          section:sections(id, name, grade_level:grade_levels(id, name)),
          academic_year:academic_years(id, name)
        )
      `, { count: 'exact' })
    
    // Filter by campus_id if provided, otherwise use admin's school_id
    if (campus_id) {
      query = query.eq('school_id', campus_id)
    } else {
      query = query.eq('school_id', schoolId)
    }

    // Execute main query with pagination
    const { data: staffData, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('❌ Error fetching staff:', error)
      throw error
    }

    // SECURITY: Filter to only include teachers from the requested school (campus or admin school)
    const targetSchoolId = campus_id || schoolId
    let teachers = staffData?.filter((staff: any) => {
      const isTeacher = staff.profile?.role === 'teacher'
      const isCorrectSchool = staff.school_id === targetSchoolId

      if (isTeacher && !isCorrectSchool) {
        console.error('🚨 SECURITY ALERT: Teacher from different school detected!', {
          staffId: staff.id,
          staffSchoolId: staff.school_id,
          requestedSchoolId: targetSchoolId
        })
      }

      return isTeacher && isCorrectSchool
    }) || []

    // Apply search filter if provided
    if (search) {
      teachers = teachers.filter((teacher: any) => {
        const fullName = `${teacher.profile?.first_name} ${teacher.profile?.last_name}`.toLowerCase()
        const email = teacher.profile?.email?.toLowerCase() || ''
        const employeeNumber = teacher.employee_number?.toLowerCase() || ''
        const department = teacher.department?.toLowerCase() || ''

        return fullName.includes(search) ||
          email.includes(search) ||
          employeeNumber.includes(search) ||
          department.includes(search)
      })
    }

    const total = teachers.length
    const totalPages = Math.ceil(total / limit)

    console.log('✅ Found teachers:', { total, page, totalPages })

    return {
      success: true,
      data: {
        data: teachers as Staff[],
        total,
        page,
        totalPages
      }
    }
  } catch (error: any) {
    console.error('Error fetching teachers:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const getTeacherById = async (teacherId: string, schoolId?: string): Promise<ApiResponse<Staff>> => {
  try {
    // Use raw SQL for optimal performance with LEFT JOIN
    const { data, error } = await supabase.rpc('get_teacher_with_salary', {
      p_teacher_id: teacherId,
      p_school_id: schoolId
    }).maybeSingle()

    if (error) {
      // Fallback to regular query if RPC doesn't exist
      console.warn('⚠️ RPC not found, using fallback query:', error.message)
      
      const query = supabase
        .from('staff')
        .select(`
          *,
          profile:profiles!staff_profile_id_fkey(*),
          grade_level:grade_levels(id, name),
          section:sections(id, name, capacity)
        `)
        .eq('id', teacherId)

      if (schoolId) {
        query.eq('school_id', schoolId)
      }

      const { data: staffData, error: staffError } = await query.single()
      if (staffError) throw staffError

      // Fetch base_salary separately
      const { data: salaryData } = await supabase
        .from('salary_structures')
        .select('base_salary')
        .eq('staff_id', teacherId)
        .eq('is_current', true)
        .maybeSingle()

      return {
        success: true,
        data: {
          ...staffData,
          base_salary: salaryData?.base_salary || 0
        } as Staff
      }
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      throw new Error('Teacher not found')
    }

    const teacherData = Array.isArray(data) ? data[0] : data

    return {
      success: true,
      data: teacherData as Staff
    }
  } catch (error: any) {
    console.error('Error fetching teacher:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const createTeacher = async (dto: CreateStaffDTO): Promise<ApiResponse<Staff & { credentials?: { username: string, password: string } }>> => {
  try {
    let profileId = dto.profile_id
    let finalPassword: string
    let finalUsername: string

    // If no profile_id provided, create a new user
    if (!profileId && dto.email) {
      // Check if user with this email already exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', dto.email)
        .maybeSingle()

      if (checkError) throw checkError

      if (existingProfile) {
        throw new Error(`A user with email ${dto.email} already exists`)
      }

      // Use provided username or use email as username (no auto-generation)
      if (dto.username) {
        finalUsername = dto.username
      } else {
        // Use email as username if not provided
        finalUsername = dto.email
      }

      // Use provided password or generate one
      finalPassword = dto.password || generateSecurePassword()

      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: dto.email,
        password: finalPassword,
        email_confirm: true,
        user_metadata: {
          first_name: dto.first_name,
          last_name: dto.last_name,
          phone: dto.phone,
          username: finalUsername
        }
      })

      if (authError) throw authError

      // Upsert profile (in case it was auto-created by a trigger)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authUser.user.id,
          school_id: dto.school_id,
          role: 'teacher',
          first_name: dto.first_name,
          last_name: dto.last_name,
          email: dto.email,
          phone: dto.phone
        }, {
          onConflict: 'id'
        })
        .select()
        .single()

      if (profileError) throw profileError

      profileId = profile.id
    }

    // Use provided employee number or auto-generate
    let employeeNumber = dto.employee_number
    if (!employeeNumber) {
      const year = new Date().getFullYear()
      const { count, error: countError } = await supabase
        .from('staff')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', dto.school_id)

      if (countError) throw countError

      const nextNumber = (count || 0) + 1
      employeeNumber = `TCH-${year}-${nextNumber.toString().padStart(4, '0')}`
    }

    // Create staff record with all fields
    const { data, error } = await supabase
      .from('staff')
      .insert({
        profile_id: profileId,
        school_id: dto.school_id,
        employee_number: employeeNumber,
        title: dto.title,
        department: dto.department,
        qualifications: dto.qualifications,
        specialization: dto.specialization,
        date_of_joining: dto.date_of_joining,
        employment_type: dto.employment_type || 'full_time',
        payment_type: dto.payment_type || 'fixed_salary',
        permissions: dto.permissions || {},
        role: 'teacher',  // Always set role to 'teacher' for teachers
        custom_fields: dto.custom_fields || {}
      })
      .select(`
        *,
        profile:profiles!staff_profile_id_fkey(*)
      `)
      .single()

    if (error) throw error

    // Create Salary Structure if base_salary is provided
    if (dto.base_salary && dto.base_salary > 0) {
      const { error: salaryError } = await supabase
        .from('salary_structures')
        .insert({
          staff_id: data.id,
          school_id: dto.school_id,
          base_salary: dto.base_salary,
          effective_from: dto.date_of_joining || new Date().toISOString().split('T')[0],
          is_current: true,
          created_at: new Date().toISOString()
        })
        .select()

      if (salaryError) {
        console.error('❌ Failed to create salary structure for teacher:', salaryError)
        // Don't throw - teacher is already created, salary can be added later
      }
    }

    return {
      success: true,
      data: data as Staff,
      message: 'Teacher created successfully'
    }
  } catch (error: any) {
    console.error('Error creating teacher:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// Helper function to generate secure password
function generateSecurePassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const special = '!@#$%^&*'
  const allChars = uppercase + lowercase + numbers + special

  let password = ''
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += special[Math.floor(Math.random() * special.length)]

  // Fill remaining characters
  for (let i = password.length; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('')
}

export const updateTeacher = async (
  teacherId: string,
  dto: UpdateStaffDTO
): Promise<ApiResponse<Staff>> => {
  try {
    // Prepare staff update object
    const staffUpdate: any = {}
    if (dto.employee_number !== undefined) staffUpdate.employee_number = dto.employee_number
    if (dto.title !== undefined) staffUpdate.title = dto.title
    if (dto.department !== undefined) staffUpdate.department = dto.department
    if (dto.qualifications !== undefined) staffUpdate.qualifications = dto.qualifications
    if (dto.specialization !== undefined) staffUpdate.specialization = dto.specialization
    if (dto.date_of_joining !== undefined) staffUpdate.date_of_joining = dto.date_of_joining
    if (dto.employment_type !== undefined) staffUpdate.employment_type = dto.employment_type
    if (dto.payment_type !== undefined) staffUpdate.payment_type = dto.payment_type
    if (dto.role !== undefined) staffUpdate.role = dto.role
    if (dto.grade_level_id !== undefined) staffUpdate.grade_level_id = dto.grade_level_id
    if (dto.section_id !== undefined) staffUpdate.section_id = dto.section_id
    if (dto.is_active !== undefined) staffUpdate.is_active = dto.is_active
    if (dto.permissions !== undefined) staffUpdate.permissions = dto.permissions
    if (dto.custom_fields !== undefined) staffUpdate.custom_fields = dto.custom_fields

    // First, get the current staff record to get profile_id and school_id
    const { data: existingStaff, error: fetchError } = await supabase
      .from('staff')
      .select('id, profile_id, school_id')
      .eq('id', teacherId)
      .single()

    if (fetchError || !existingStaff) {
      throw new Error('Teacher not found')
    }

    // Only update staff record if there are fields to update
    if (Object.keys(staffUpdate).length > 0) {
      const { error: staffError } = await supabase
        .from('staff')
        .update(staffUpdate)
        .eq('id', teacherId)

      if (staffError) throw staffError
    }

    // Update profile if needed
    if (dto.first_name || dto.last_name || dto.email || dto.phone) {
      const profileUpdate: any = {}
      if (dto.first_name !== undefined) profileUpdate.first_name = dto.first_name
      if (dto.last_name !== undefined) profileUpdate.last_name = dto.last_name
      if (dto.email !== undefined) profileUpdate.email = dto.email
      if (dto.phone !== undefined) profileUpdate.phone = dto.phone

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', existingStaff.profile_id)

      if (profileError) throw profileError
    }

    // Update password if provided
    if (dto.password && dto.password.length >= 8) {
      const { error: authError } = await supabase.auth.admin.updateUserById(
        existingStaff.profile_id,
        { password: dto.password }
      )

      if (authError) throw authError
    }

    // Update base_salary if provided - Use optimized approach
    if (dto.base_salary !== undefined && dto.base_salary >= 0) {
      if (dto.base_salary > 0) {
        // First, mark all existing salary structures as not current
        await supabase
          .from('salary_structures')
          .update({ is_current: false })
          .eq('staff_id', teacherId)
          .eq('is_current', true)

        // Insert new salary structure (always create new for audit trail)
        const { error: salaryError } = await supabase
          .from('salary_structures')
          .insert({
            staff_id: teacherId,
            school_id: existingStaff.school_id,
            base_salary: dto.base_salary,
            effective_from: new Date().toISOString().split('T')[0],
            is_current: true
          })

        if (salaryError) {
          console.error('❌ Failed to update salary structure:', salaryError)
          // Don't throw - teacher update should succeed even if salary fails
        }
      }
    }

    // Fetch updated data with profile, grade, section, and salary
    const { data, error } = await supabase
      .from('staff')
      .select(`
        *,
        profile:profiles!staff_profile_id_fkey(*),
        grade_level:grade_levels(id, name),
        section:sections(id, name, capacity)
      `)
      .eq('id', teacherId)
      .single()

    if (error) throw error

    // Fetch current base_salary
    const { data: salaryData } = await supabase
      .from('salary_structures')
      .select('base_salary')
      .eq('staff_id', teacherId)
      .eq('is_current', true)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle()

    return {
      success: true,
      data: {
        ...data,
        base_salary: salaryData?.base_salary || 0
      } as Staff,
      message: 'Teacher updated successfully'
    }
  } catch (error: any) {
    console.error('Error updating teacher:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const deleteTeacher = async (teacherId: string): Promise<ApiResponse<void>> => {
  try {
    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('staff')
      .update({ is_active: false })
      .eq('id', teacherId)

    if (error) throw error

    return {
      success: true,
      message: 'Teacher deleted successfully'
    }
  } catch (error: any) {
    console.error('Error deleting teacher:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// ============================================================================
// STEP 1: WORKLOAD ALLOCATION (Teacher ↔ Subject ↔ Section)
// ============================================================================

export const getTeacherAssignments = async (
  schoolId: string,
  teacherId?: string,
  academicYearId?: string
): Promise<ApiResponse<TeacherSubjectAssignment[]>> => {
  try {
    let query = supabase
      .from('teacher_subject_assignments')
      .select(`
        *,
        teacher:staff!teacher_id(id, profile:profiles!staff_profile_id_fkey(first_name, last_name)),
        subject:subjects(id, name, code),
        section:sections(id, name, grade_level:grade_levels(id, name)),
        academic_year:academic_years(name)
      `)
      .eq('campus_id', schoolId) // Use campus_id for campus-specific filtering

    if (teacherId) query = query.eq('teacher_id', teacherId)
    if (academicYearId) query = query.eq('academic_year_id', academicYearId)

    const { data, error } = await query.order('assigned_at', { ascending: false })

    if (error) throw error

    // Transform the data to flatten joined fields
    const assignments = data.map((item: any) => ({
      ...item,
      teacher_name: item.teacher?.profile ?
        `${item.teacher.profile.first_name} ${item.teacher.profile.last_name}`.trim() :
        'Unknown',
      subject_name: item.subject?.name,
      section_name: item.section?.name,
      grade_name: item.section?.grade_level?.name
    }))

    return {
      success: true,
      data: assignments as TeacherSubjectAssignment[]
    }
  } catch (error: any) {
    console.error('Error fetching teacher assignments:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const createTeacherAssignment = async (
  dto: CreateTeacherAssignmentDTO
): Promise<ApiResponse<TeacherSubjectAssignment>> => {
  try {
    // Check if another teacher is already assigned as primary
    if (dto.is_primary !== false) {
      const { data: existing, error: checkError } = await supabase
        .from('teacher_subject_assignments')
        .select('*, teacher:staff!teacher_id(profile:profiles!staff_profile_id_fkey(first_name, last_name))')
        .eq('subject_id', dto.subject_id)
        .eq('section_id', dto.section_id)
        .eq('academic_year_id', dto.academic_year_id)
        .eq('is_primary', true)
        .maybeSingle()

      if (checkError) throw checkError

      if (existing) {
        return {
          success: false,
          error: `${existing.teacher.profile.first_name} ${existing.teacher.profile.last_name} is already assigned as primary teacher for this subject-section combination`
        }
      }
    }

    const { data, error } = await supabase
      .from('teacher_subject_assignments')
      .insert({
        school_id: dto.school_id,
        campus_id: dto.school_id, // campus_id = school_id for campus-specific records
        teacher_id: dto.teacher_id,
        subject_id: dto.subject_id,
        section_id: dto.section_id,
        academic_year_id: dto.academic_year_id,
        is_primary: dto.is_primary !== false,
        assigned_by: dto.assigned_by
      })
      .select(`
        *,
        teacher:staff!teacher_id(profile:profiles!staff_profile_id_fkey(first_name, last_name)),
        subject:subjects(name),
        section:sections(name, grade_level:grade_levels(name))
      `)
      .single()

    if (error) throw error

    return {
      success: true,
      data: data as TeacherSubjectAssignment,
      message: 'Teacher assignment created successfully'
    }
  } catch (error: any) {
    console.error('Error creating teacher assignment:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const deleteTeacherAssignment = async (
  assignmentId: string
): Promise<ApiResponse<void>> => {
  try {
    const { error } = await supabase
      .from('teacher_subject_assignments')
      .delete()
      .eq('id', assignmentId)

    if (error) throw error

    return {
      success: true,
      message: 'Teacher assignment removed successfully'
    }
  } catch (error: any) {
    console.error('Error deleting teacher assignment:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// ============================================================================
// ACADEMIC YEAR MANAGEMENT
// ============================================================================

export const getAcademicYears = async (schoolId: string): Promise<ApiResponse<AcademicYear[]>> => {
  try {
    // Get main school ID (in case this is a campus)
    const mainSchoolId = await getMainSchoolId(schoolId)
    
    const { data, error } = await supabase
      .from('academic_years')
      .select('*')
      .eq('school_id', mainSchoolId)
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
    // Get main school ID (in case this is a campus)
    const mainSchoolId = await getMainSchoolId(schoolId)
    
    const { data, error } = await supabase
      .from('academic_years')
      .select('*')
      .eq('school_id', mainSchoolId)
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

    const { data, error } = await supabase
      .from('academic_years')
      .insert(dto)
      .select()
      .single()

    if (error) throw error

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

    const { data, error } = await supabase
      .from('academic_years')
      .update(dto)
      .eq('id', yearId)
      .select()
      .single()

    if (error) throw error

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

// ============================================================================
// PERIOD MANAGEMENT
// ============================================================================

export const getPeriods = async (schoolId: string, campusId?: string): Promise<ApiResponse<Period[]>> => {
  try {
    // Get main school ID (in case this is a campus)
    const mainSchoolId = await getMainSchoolId(schoolId)
    
    let query = supabase
      .from('periods')
      .select('*')
      .eq('school_id', mainSchoolId)
      .eq('is_active', true)
      // Order by sort_order first (new schema), then period_number (old schema) as fallback
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('period_number', { ascending: true })

    // Filter by campus - include campus-specific periods AND school-wide periods (null campus_id)
    if (campusId) {
      // Get periods for this campus OR school-wide periods (campus_id is null)
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    const { data, error } = await query

    if (error) throw error

    // Ensure backward compatibility: populate period_number from sort_order if missing
    const normalizedData = (data || []).map(period => ({
      ...period,
      period_number: period.period_number || period.sort_order || 0,
      period_name: period.period_name || period.title || null,
    }))

    return {
      success: true,
      data: normalizedData as Period[]
    }
  } catch (error: any) {
    console.error('Error fetching periods:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const createPeriod = async (dto: CreatePeriodDTO): Promise<ApiResponse<Period>> => {
  try {
    const { data, error } = await supabase
      .from('periods')
      .insert(dto)
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      data: data as Period,
      message: 'Period created successfully'
    }
  } catch (error: any) {
    console.error('Error creating period:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const updatePeriod = async (
  periodId: string,
  dto: UpdatePeriodDTO
): Promise<ApiResponse<Period>> => {
  try {
    const { data, error } = await supabase
      .from('periods')
      .update(dto)
      .eq('id', periodId)
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      data: data as Period,
      message: 'Period updated successfully'
    }
  } catch (error: any) {
    console.error('Error updating period:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const deletePeriod = async (periodId: string): Promise<ApiResponse<void>> => {
  try {
    const { error } = await supabase
      .from('periods')
      .update({ is_active: false })
      .eq('id', periodId)

    if (error) throw error

    return {
      success: true,
      message: 'Period deleted successfully'
    }
  } catch (error: any) {
    console.error('Error deleting period:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
