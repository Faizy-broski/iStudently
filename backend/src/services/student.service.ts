import { supabase } from '../config/supabase'
import { Student, CreateStudentDTO, UpdateStudentDTO } from '../types'

export class StudentService {
  /**
   * Get all students for a specific school with pagination and search
   * Enforces tenant isolation via school_id
   */
  async getStudents(
    schoolId: string,
    page: number = 1,
    limit: number = 10,
    search?: string,
    gradeLevel?: string
  ) {
    const offset = (page - 1) * limit

    // Use optimized database search function for library operations when searching
    if (search && search.trim()) {
      try {
        const { data: searchResults, error: searchError } = await supabase.rpc(
          'search_students_for_library',
          {
            p_school_id: schoolId,
            p_search: search.trim(),
            p_limit: 100 // Fetch more for client-side grade filtering if needed
          }
        );

        if (searchError) {
          console.error('Optimized search error, falling back:', searchError);
          // Fall through to standard query
        } else {
          // Apply grade filter client-side if needed
          let filtered = searchResults || [];
          if (gradeLevel) {
            filtered = filtered.filter((s: any) => s.grade_level === gradeLevel);
          }

          // Apply pagination
          const total = filtered.length;
          const paginatedData = filtered.slice(offset, offset + limit);

          // Get all student IDs for batch parent links query
          const studentIds = paginatedData.map((s: any) => s.student_id);

          // Fetch parent links for ALL students in ONE query (fixes N+1 problem)
          const { data: parentLinksData } = await supabase
            .from('parent_student_links')
            .select(`
              student_id,
              parent:parents(
                id,
                profile:profiles(
                  first_name,
                  last_name,
                  email,
                  phone
                )
              ),
              relationship,
              relation_type
            `)
            .in('student_id', studentIds)
            .eq('is_active', true);

          // Create a map of student_id -> parent_links for quick lookup
          const parentLinksMap = new Map<string, any[]>();
          (parentLinksData || []).forEach((link: any) => {
            if (!parentLinksMap.has(link.student_id)) {
              parentLinksMap.set(link.student_id, []);
            }
            parentLinksMap.get(link.student_id)!.push(link);
          });

          // Enrich student data with parent links
          const enrichedData = paginatedData.map((student: any) => ({
            id: student.student_id,
            student_number: student.student_number,
            grade_level: student.grade_level,
            profile_id: student.profile_id,
            school_id: schoolId,
            profile: {
              id: student.profile_id,
              first_name: student.first_name,
              last_name: student.last_name,
              email: student.email,
              is_active: student.is_active
            },
            parent_links: parentLinksMap.get(student.student_id) || []
          }));

          return {
            students: enrichedData,
            pagination: {
              total,
              page,
              limit,
              totalPages: Math.ceil(total / limit)
            }
          };
        }
      } catch (err) {
        console.error('Search function not available, using standard query:', err);
        // Fall through to standard query
      }
    }

    // Standard query (no search or fallback)
    let query = supabase
      .from('students')
      .select(`
        *,
        profile:profiles(
          id,
          first_name,
          last_name,
          email,
          phone,
          avatar_url,
          is_active
        ),
        parent_links:parent_student_links(
          parent:parents(
            id,
            profile:profiles(
              first_name,
              last_name,
              email,
              phone
            )
          ),
          relationship,
          relation_type
        )
      `, { count: 'exact' })
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })

    // Apply grade filter
    if (gradeLevel) {
      query = query.eq('grade_level', gradeLevel)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch students: ${error.message}`)
    }

    return {
      students: data || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      }
    }
  }

  /**
   * Get a single student by ID with tenant isolation
   */
  async getStudentById(studentId: string, schoolId: string): Promise<Student | null> {
    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        profile:profiles(
          id,
          first_name,
          last_name,
          email,
          phone,
          avatar_url,
          is_active,
          role
        ),
        parent_links:parent_student_links!inner(
          parent:parents(
            id,
            profile:profiles(
              first_name,
              last_name,
              email,
              phone
            )
          ),
          relationship,
          relation_type
        )
      `)
      .eq('id', studentId)
      .eq('school_id', schoolId)
      .eq('parent_links.is_active', true)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to fetch student: ${error.message}`)
    }

    return data
  }

  /**
   * Get student by student number with tenant isolation
   */
  async getStudentByNumber(studentNumber: string, schoolId: string): Promise<Student | null> {
    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        profile:profiles(*)
      `)
      .eq('student_number', studentNumber)
      .eq('school_id', schoolId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to fetch student: ${error.message}`)
    }

    return data
  }

  /**
   * Create a new student with tenant isolation
   * If profile_id not provided, creates a new profile first
   */
  async createStudent(studentData: CreateStudentDTO): Promise<Student> {
    let profileId = studentData.profile_id

    // Create profile if not provided
    if (!profileId && studentData.first_name && studentData.last_name) {
      // Email is now required for student creation
      if (!studentData.email || !studentData.email.trim()) {
        throw new Error('Email is required for student creation')
      }
      
      const tempPassword = studentData.password || Math.random().toString(36).slice(-12) + 'A1!' // Use provided or generate strong password

      // Create auth user first (this creates the user in auth.users)
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: studentData.email,
        password: tempPassword,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          first_name: studentData.first_name,
          last_name: studentData.last_name,
          role: 'student'
        }
      })

      if (authError || !authUser.user) {
        throw new Error(`Failed to create auth user: ${authError?.message || 'Unknown error'}`)
      }

      profileId = authUser.user.id

      // Now create/update the profile with the auth user's ID
      const { data: newProfile, error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: profileId,
          school_id: studentData.school_id,
          role: 'student',
          first_name: studentData.first_name,
          father_name: studentData.father_name, // NEW: Save father's name
          grandfather_name: studentData.grandfather_name, // NEW: Save grandfather's name
          last_name: studentData.last_name,
          email: studentData.email,
          phone: studentData.phone,
          profile_photo_url: studentData.profile_photo_url, // NEW: Supabase storage URL
          is_active: true
        })
        .select()
        .single()

      if (profileError) {
        // If profile creation fails, try to clean up the auth user
        await supabase.auth.admin.deleteUser(profileId)
        throw new Error(`Failed to create profile: ${profileError.message}`)
      }

      profileId = newProfile.id
    }

    if (!profileId) {
      throw new Error('profile_id or profile data (first_name, last_name) is required')
    }

    // Check if student number already exists in this school
    const existing = await this.getStudentByNumber(studentData.student_number, studentData.school_id)
    if (existing) {
      throw new Error('Student number already exists in this school')
    }

    // Create student record
    const { data, error } = await supabase
      .from('students')
      .insert({
        profile_id: profileId,
        school_id: studentData.school_id,
        student_number: studentData.student_number,
        grade_level: studentData.grade_level, // Legacy field
        grade_level_id: studentData.grade_level_id, // New: UUID reference
        section_id: studentData.section_id, // New: UUID reference (triggers auto-update)
        medical_info: studentData.medical_info || {},
        custom_fields: studentData.custom_fields || {}
      })
      .select(`
        *,
        profile:profiles(*)
      `)
      .single()

    if (error) {
      throw new Error(`Failed to create student: ${error.message}`)
    }

    // Link parent if provided in custom_fields
    const linkedParentId = studentData.custom_fields?.family?.linked_parent_id
    const parentRelationType = studentData.custom_fields?.family?.parent_relation_type || 'other'

    if (linkedParentId && data.id) {
      try {
        await supabase
          .from('parent_student_links')
          .insert({
            parent_id: linkedParentId,
            student_id: data.id,
            relationship: parentRelationType === 'both' ? 'Both Parents' :
              parentRelationType === 'father' ? 'Father' :
                parentRelationType === 'mother' ? 'Mother' :
                  parentRelationType === 'guardian' ? 'Guardian' : 'Parent',
            relation_type: parentRelationType,
            is_emergency_contact: true,
            is_active: true
          })
      } catch (linkError: any) {
        console.error('Failed to link parent to student:', linkError)
        // If it's a policy violation, throw it so the user knows
        if (linkError.message?.includes('Policy')) {
          throw new Error(`Failed to link parent: ${linkError.message}`)
        }
        // Don't throw error for other cases - student was created successfully
      }
    }

    return data
  }

  /**
   * Update a student with tenant isolation
   */
  async updateStudent(
    studentId: string,
    schoolId: string,
    updateData: UpdateStudentDTO
  ): Promise<Student> {
    // First verify the student belongs to this school
    const existing = await this.getStudentById(studentId, schoolId)
    if (!existing) {
      throw new Error('Student not found or does not belong to this school')
    }

    // Update profile if profile data is provided
    if (updateData.first_name || updateData.father_name || updateData.grandfather_name || 
        updateData.last_name || updateData.email || updateData.phone || updateData.profile_photo_url) {
      const profileUpdates: any = {}
      if (updateData.first_name !== undefined) profileUpdates.first_name = updateData.first_name
      if (updateData.father_name !== undefined) profileUpdates.father_name = updateData.father_name
      if (updateData.grandfather_name !== undefined) profileUpdates.grandfather_name = updateData.grandfather_name
      if (updateData.last_name !== undefined) profileUpdates.last_name = updateData.last_name
      if (updateData.email !== undefined) profileUpdates.email = updateData.email
      if (updateData.phone !== undefined) profileUpdates.phone = updateData.phone
      if (updateData.profile_photo_url !== undefined) profileUpdates.profile_photo_url = updateData.profile_photo_url

      if (Object.keys(profileUpdates).length > 0 && existing.profile_id) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update(profileUpdates)
          .eq('id', existing.profile_id)

        if (profileError) {
          throw new Error(`Failed to update profile: ${profileError.message}`)
        }
      }
    }

    // Update password if provided
    if (updateData.password && updateData.password.length >= 8) {
      if (existing.profile_id) {
        const { error: authError } = await supabase.auth.admin.updateUserById(
          existing.profile_id,
          { password: updateData.password }
        )

        if (authError) throw new Error(`Failed to update password: ${authError.message}`)
      }
    }

    // Update student record
    const studentUpdates: any = {}
    if (updateData.student_number) studentUpdates.student_number = updateData.student_number
    if (updateData.grade_level !== undefined) studentUpdates.grade_level = updateData.grade_level
    if (updateData.grade_level_id !== undefined) studentUpdates.grade_level_id = updateData.grade_level_id
    if (updateData.section_id !== undefined) studentUpdates.section_id = updateData.section_id
    if (updateData.medical_info !== undefined) studentUpdates.medical_info = updateData.medical_info
    if (updateData.custom_fields !== undefined) studentUpdates.custom_fields = updateData.custom_fields

    const { data, error } = await supabase
      .from('students')
      .update(studentUpdates)
      .eq('id', studentId)
      .eq('school_id', schoolId)
      .select(`
        *,
        profile:profiles(*)
      `)
      .single()

    if (error) {
      throw new Error(`Failed to update student: ${error.message}`)
    }

    return data
  }

  /**
   * Delete a student with tenant isolation
   */
  async deleteStudent(studentId: string, schoolId: string): Promise<void> {
    // First verify the student belongs to this school
    const existing = await this.getStudentById(studentId, schoolId)
    if (!existing) {
      throw new Error('Student not found or does not belong to this school')
    }

    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', studentId)
      .eq('school_id', schoolId)

    if (error) {
      throw new Error(`Failed to delete student: ${error.message}`)
    }
  }

  /**
   * Get students by grade level with tenant isolation
   */
  async getStudentsByGrade(schoolId: string, gradeLevel: string) {
    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        profile:profiles(
          first_name,
          last_name,
          email
        )
      `)
      .eq('school_id', schoolId)
      .eq('grade_level', gradeLevel)
      .order('profile.last_name', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch students by grade: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get student statistics for a school
   */
  async getStudentStats(schoolId: string) {
    const { data, error } = await supabase
      .from('students')
      .select('grade_level, profile:profiles(is_active)')
      .eq('school_id', schoolId)

    if (error) {
      throw new Error(`Failed to fetch student stats: ${error.message}`)
    }

    const stats = {
      total: data?.length || 0,
      active: data?.filter((s: any) => s.profile?.is_active).length || 0,
      inactive: data?.filter((s: any) => !s.profile?.is_active).length || 0,
      byGrade: {} as Record<string, number>
    }

    // Count by grade
    data?.forEach(student => {
      if (student.grade_level) {
        stats.byGrade[student.grade_level] = (stats.byGrade[student.grade_level] || 0) + 1
      }
    })

    return stats
  }

  /**
   * Get students for advanced report with proper joins
   */
  async getStudentsReport(
    schoolId: string,
    page: number = 1,
    limit: number = 1000
  ) {
    const offset = (page - 1) * limit

    const { data, error, count } = await supabase
      .from('students')
      .select(`
        id,
        student_number,
        grade_level_id,
        section_id,
        custom_fields,
        created_at,
        profile:profiles(
          id,
          first_name,
          last_name,
          father_name,
          grandfather_name,
          email,
          phone,
          is_active
        ),
        grade:grade_levels!grade_level_id(
          id,
          name
        ),
        section:sections!section_id(
          id,
          name
        )
      `, { count: 'exact' })
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      throw new Error(`Failed to fetch students report: ${error.message}`)
    }

    // Flatten the data structure for easier frontend consumption
    const students = (data || []).map(student => {
      const profile = Array.isArray(student.profile) ? student.profile[0] : student.profile;
      return {
        id: student.id,
        student_number: student.student_number,
        first_name: profile?.first_name || '',
        last_name: profile?.last_name || '',
        father_name: profile?.father_name || '',
        grandfather_name: profile?.grandfather_name || '',
        email: profile?.email || '',
        phone: profile?.phone || '',
        is_active: profile?.is_active || false,
        grade_level_id: student.grade_level_id,
        grade_level_name: (student as any).grade?.name || '',
        section_id: student.section_id,
        section_name: (student as any).section?.name || '',
        custom_fields: student.custom_fields || {},
        created_at: student.created_at
      }
    })

    return {
      students,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      }
    }
  }
}

