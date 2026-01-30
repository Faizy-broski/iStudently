import { supabase } from '../config/supabase'
import {
  Parent,
  CreateParentDTO,
  UpdateParentDTO,
  CreateParentStudentLinkDTO,
  StudentWithRelationship
} from '../types'

export class ParentService {
  /**
   * Get all parents for a specific school with pagination and search
   * Enforces tenant isolation via school_id
   */
  async getParents(
    schoolId: string,
    page: number = 1,
    limit: number = 10,
    search?: string
  ) {
    const offset = (page - 1) * limit

    // Build query with tenant isolation
    let query = supabase
      .from('parents')
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
        )
      `, { count: 'exact' })
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })

    // Apply search filter on profile fields
    if (search) {
      // Note: Supabase doesn't support OR on nested fields directly
      // So we'll fetch and filter in memory for now
      // In production, consider using a database view or function
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch parents: ${error.message}`)
    }

    // Filter in memory if search is provided
    let filteredData = data || []
    if (search && filteredData.length > 0) {
      const searchLower = search.toLowerCase()
      filteredData = filteredData.filter(parent => {
        const profile = parent.profile
        if (!profile) return false

        return (
          profile.first_name?.toLowerCase().includes(searchLower) ||
          profile.last_name?.toLowerCase().includes(searchLower) ||
          profile.email?.toLowerCase().includes(searchLower) ||
          profile.phone?.includes(search)
        )
      })
    }

    return {
      parents: filteredData,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      }
    }
  }

  /**
   * Get parents with their associated children
   */
  async getParentsWithChildren(
    schoolId: string,
    page: number = 1,
    limit: number = 10,
    search?: string
  ) {
    const offset = (page - 1) * limit

    // First get parents
    let query = supabase
      .from('parents')
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
        )
      `, { count: 'exact' })
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: parents, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch parents: ${error.message}`)
    }

    if (!parents || parents.length === 0) {
      return {
        parents: [],
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0
        }
      }
    }

    // Get children for each parent
    const parentIds = parents.map(p => p.id)
    const { data: links, error: linksError } = await supabase
      .from('parent_student_links')
      .select(`
        parent_id,
        student_id,
        relationship,
        relation_type,
        is_emergency_contact,
        student:students(
          id,
          student_number,
          grade_level,
          profile:profiles(
            first_name,
            last_name
          )
        )
      `)
      .in('parent_id', parentIds)
      .eq('is_active', true)

    if (linksError) {
      throw new Error(`Failed to fetch parent-student links: ${linksError.message}`)
    }

    // Map children to parents
    const parentsWithChildren = parents.map(parent => {
      const children = links
        ?.filter((link: any) => link.parent_id === parent.id)
        .map((link: any) => ({
          id: link.student?.id || '',
          student_id: link.student_id,
          student_number: link.student?.student_number || '',
          grade_level: link.student?.grade_level || null,
          profile: link.student?.profile,
          relationship: link.relationship,
          is_emergency_contact: link.is_emergency_contact
        })) || []

      return {
        ...parent,
        children
      }
    })

    // Filter by search if provided
    let filteredParents = parentsWithChildren
    if (search) {
      const searchLower = search.toLowerCase()
      filteredParents = parentsWithChildren.filter(parent => {
        const profile: any = parent.profile
        if (!profile) return false

        return (
          profile.first_name?.toLowerCase().includes(searchLower) ||
          profile.last_name?.toLowerCase().includes(searchLower) ||
          profile.email?.toLowerCase().includes(searchLower) ||
          profile.phone?.includes(search)
        )
      })
    }

    return {
      parents: filteredParents,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      }
    }
  }

  /**
   * Get a single parent by ID with tenant isolation
   */
  async getParentById(parentId: string, schoolId: string): Promise<Parent | null> {
    const { data, error } = await supabase
      .from('parents')
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
        )
      `)
      .eq('id', parentId)
      .eq('school_id', schoolId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to fetch parent: ${error.message}`)
    }

    return data
  }

  /**
   * Get parent with their children
   */
  async getParentWithChildren(parentId: string, schoolId: string) {
    const parent = await this.getParentById(parentId, schoolId)
    if (!parent) {
      return null
    }

    // Get children
    const { data: links, error } = await supabase
      .from('parent_student_links')
      .select(`
        student_id,
        relationship,
        relation_type,
        is_emergency_contact,
        student:students(
          id,
          student_number,
          grade_level,
          school_id,
          profile:profiles(
            first_name,
            last_name,
            email
          )
        )
      `)
      .eq('parent_id', parentId)
      .eq('is_active', true)

    if (error) {
      throw new Error(`Failed to fetch children: ${error.message}`)
    }

    // Filter only children from the same school
    const children = links
      ?.filter((link: any) => link.student?.school_id === schoolId)
      .map((link: any) => ({
        id: link.student?.id || '',
        student_id: link.student_id,
        student_number: link.student?.student_number || '',
        grade_level: link.student?.grade_level || null,
        profile: link.student?.profile,
        relationship: link.relationship,
        is_emergency_contact: link.is_emergency_contact
      })) || []

    return {
      ...parent,
      children
    }
  }

  /**
   * Create a new parent with tenant isolation
   */
  async createParent(parentData: CreateParentDTO): Promise<Parent> {
    let profileId = parentData.profile_id

    // Create profile if not provided
    if (!profileId && parentData.first_name && parentData.last_name) {
      // Generate a temporary email if not provided (required for auth user)
      const tempEmail = parentData.email || `${parentData.first_name.toLowerCase()}.${parentData.last_name.toLowerCase()}@temp.local`
      const tempPassword = parentData.password || Math.random().toString(36).slice(-12) + 'A1!' // Use provided or generate strong password

      // Create auth user first (this creates the user in auth.users)
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: tempEmail,
        password: tempPassword,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          first_name: parentData.first_name,
          last_name: parentData.last_name,
          role: 'parent'
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
          school_id: parentData.school_id,
          role: 'parent',
          first_name: parentData.first_name,
          last_name: parentData.last_name,
          email: parentData.email || tempEmail,
          phone: parentData.phone,
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

    // Create parent record
    const { data, error } = await supabase
      .from('parents')
      .insert({
        profile_id: profileId,
        school_id: parentData.school_id,
        occupation: parentData.occupation,
        workplace: parentData.workplace,
        income: parentData.income,
        cnic: parentData.cnic,
        address: parentData.address,
        city: parentData.city,
        state: parentData.state,
        zip_code: parentData.zip_code,
        country: parentData.country,
        emergency_contact_name: parentData.emergency_contact_name,
        emergency_contact_relation: parentData.emergency_contact_relation,
        emergency_contact_phone: parentData.emergency_contact_phone,
        notes: parentData.notes,
        metadata: parentData.metadata || {},
        custom_fields: parentData.custom_fields || {}
      })
      .select(`
        *,
        profile:profiles(*)
      `)
      .single()

    if (error) {
      throw new Error(`Failed to create parent: ${error.message}`)
    }

    return data
  }

  /**
   * Update a parent with tenant isolation
   */
  async updateParent(
    parentId: string,
    schoolId: string,
    updateData: UpdateParentDTO
  ): Promise<Parent> {
    // First verify the parent belongs to this school
    const existing = await this.getParentById(parentId, schoolId)
    if (!existing) {
      throw new Error('Parent not found or does not belong to this school')
    }

    // Update profile if profile data is provided
    if (updateData.first_name || updateData.last_name || updateData.email || updateData.phone) {
      const profileUpdates: any = {}
      if (updateData.first_name) profileUpdates.first_name = updateData.first_name
      if (updateData.last_name) profileUpdates.last_name = updateData.last_name
      if (updateData.email) profileUpdates.email = updateData.email
      if (updateData.phone) profileUpdates.phone = updateData.phone

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

    // Update parent record
    const parentUpdates: any = {}
    if (updateData.occupation !== undefined) parentUpdates.occupation = updateData.occupation
    if (updateData.workplace !== undefined) parentUpdates.workplace = updateData.workplace
    if (updateData.income !== undefined) parentUpdates.income = updateData.income
    if (updateData.cnic !== undefined) parentUpdates.cnic = updateData.cnic
    if (updateData.address !== undefined) parentUpdates.address = updateData.address
    if (updateData.city !== undefined) parentUpdates.city = updateData.city
    if (updateData.state !== undefined) parentUpdates.state = updateData.state
    if (updateData.zip_code !== undefined) parentUpdates.zip_code = updateData.zip_code
    if (updateData.country !== undefined) parentUpdates.country = updateData.country
    if (updateData.emergency_contact_name !== undefined) parentUpdates.emergency_contact_name = updateData.emergency_contact_name
    if (updateData.emergency_contact_relation !== undefined) parentUpdates.emergency_contact_relation = updateData.emergency_contact_relation
    if (updateData.emergency_contact_phone !== undefined) parentUpdates.emergency_contact_phone = updateData.emergency_contact_phone
    if (updateData.notes !== undefined) parentUpdates.notes = updateData.notes
    if (updateData.metadata !== undefined) parentUpdates.metadata = updateData.metadata
    if (updateData.custom_fields !== undefined) parentUpdates.custom_fields = updateData.custom_fields

    if (Object.keys(parentUpdates).length > 0) {
      const { data, error } = await supabase
        .from('parents')
        .update(parentUpdates)
        .eq('id', parentId)
        .eq('school_id', schoolId)
        .select(`
          *,
          profile:profiles(*)
        `)
        .single()

      if (error) {
        throw new Error(`Failed to update parent: ${error.message}`)
      }

      return data
    }

    // If only profile was updated, fetch and return the parent
    return await this.getParentById(parentId, schoolId) as Parent
  }

  /**
   * Delete a parent with tenant isolation
   */
  async deleteParent(parentId: string, schoolId: string): Promise<void> {
    // First verify the parent belongs to this school
    const existing = await this.getParentById(parentId, schoolId)
    if (!existing) {
      throw new Error('Parent not found or does not belong to this school')
    }

    const { error } = await supabase
      .from('parents')
      .delete()
      .eq('id', parentId)
      .eq('school_id', schoolId)

    if (error) {
      throw new Error(`Failed to delete parent: ${error.message}`)
    }
  }

  /**
   * Link a parent to a student (association)
   */
  async linkParentToStudent(
    linkData: CreateParentStudentLinkDTO,
    schoolId: string
  ): Promise<void> {
    // Verify both parent and student belong to the same school
    const parent = await this.getParentById(linkData.parent_id, schoolId)
    if (!parent) {
      throw new Error('Parent not found or does not belong to this school')
    }

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, school_id')
      .eq('id', linkData.student_id)
      .eq('school_id', schoolId)
      .single()

    if (studentError || !student) {
      throw new Error('Student not found or does not belong to this school')
    }

    // Check existing active relationships for this student
    const { data: existingLinks, error: checkError } = await supabase
      .from('parent_student_links')
      .select('relation_type')
      .eq('student_id', linkData.student_id)
      .eq('is_active', true)

    if (checkError) {
      throw new Error(`Failed to check existing relationships: ${checkError.message}`)
    }

    // Validate business rules (soft validation before database constraint)
    const existingRelations = new Set(existingLinks?.map(l => l.relation_type) || [])

    if (linkData.relation_type === 'father') {
      if (existingRelations.has('father')) {
        throw new Error('Exclusivity Policy: Student already has an active Father. To change, please remove the existing Father first.')
      }
      if (existingRelations.has('both')) {
        throw new Error('Joint Entity Policy: Student has joint guardianship (Both). Cannot add individual Father role. Please remove the joint guardianship first.')
      }
    } else if (linkData.relation_type === 'mother') {
      if (existingRelations.has('mother')) {
        throw new Error('Exclusivity Policy: Student already has an active Mother. To change, please remove the existing Mother first.')
      }
      if (existingRelations.has('both')) {
        throw new Error('Joint Entity Policy: Student has joint guardianship (Both). Cannot add individual Mother role. Please remove the joint guardianship first.')
      }
    }
    // Note: 'both' is no longer a valid relation_type as per ParentRelationType
    // else if (linkData.relation_type === 'both') {
    //   if (existingRelations.has('father') || existingRelations.has('mother') || existingRelations.has('both')) {
    //     throw new Error('Joint Entity Policy: Cannot assign joint guardianship (Both) when individual Father/Mother roles exist. Please remove existing relations first.')
    //   }
    // }

    // Create the link
    const { error } = await supabase
      .from('parent_student_links')
      .insert({
        parent_id: linkData.parent_id,
        student_id: linkData.student_id,
        relationship: linkData.relationship,
        relation_type: linkData.relation_type,
        is_emergency_contact: linkData.is_emergency_contact ?? true,
        is_active: linkData.is_active ?? true
      })

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('This parent-student relationship already exists')
      }
      // Database trigger validation errors
      if (error.message.includes('Exclusivity Policy') || error.message.includes('Joint Entity Policy')) {
        throw new Error(error.message)
      }
      throw new Error(`Failed to link parent to student: ${error.message}`)
    }
  }

  /**
   * Unlink a parent from a student
   */
  async unlinkParentFromStudent(
    parentId: string,
    studentId: string,
    schoolId: string
  ): Promise<void> {
    // Verify both belong to the school
    const parent = await this.getParentById(parentId, schoolId)
    if (!parent) {
      throw new Error('Parent not found or does not belong to this school')
    }

    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('id', studentId)
      .eq('school_id', schoolId)
      .single()

    if (!student) {
      throw new Error('Student not found or does not belong to this school')
    }

    const { error } = await supabase
      .from('parent_student_links')
      .update({ is_active: false })
      .eq('parent_id', parentId)
      .eq('student_id', studentId)
      .eq('is_active', true)

    if (error) {
      throw new Error(`Failed to unlink parent from student: ${error.message}`)
    }
  }

  /**
   * Get all children for a parent
   */
  async getParentChildren(
    parentId: string,
    schoolId: string
  ): Promise<StudentWithRelationship[]> {
    const parent = await this.getParentById(parentId, schoolId)
    if (!parent) {
      throw new Error('Parent not found or does not belong to this school')
    }

    const { data, error } = await supabase
      .from('parent_student_links')
      .select(`
        student_id,
        relationship,
        relation_type,
        is_emergency_contact,
        student:students(
          id,
          student_number,
          grade_level,
          school_id,
          profile:profiles(
            first_name,
            last_name
          )
        )
      `)
      .eq('parent_id', parentId)
      .eq('is_active', true)

    if (error) {
      throw new Error(`Failed to fetch children: ${error.message}`)
    }

    // Filter only children from the same school
    return data
      ?.filter((link: any) => link.student?.school_id === schoolId)
      .map((link: any) => ({
        id: link.student?.id || '',
        student_id: link.student_id,
        student_number: link.student?.student_number || '',
        grade_level: link.student?.grade_level || null,
        profile: link.student?.profile,
        relationship: link.relationship,
        is_emergency_contact: link.is_emergency_contact
      })) || []
  }

  /**
   * Search parents by name, email, or phone
   */
  async searchParents(schoolId: string, query: string) {
    const { data: parents, error } = await supabase
      .from('parents')
      .select(`
        id,
        occupation,
        profile:profiles(
          id,
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .eq('school_id', schoolId)
      .limit(50)

    if (error) {
      throw new Error(`Failed to search parents: ${error.message}`)
    }

    if (!parents || parents.length === 0) {
      return []
    }

    // Get children for each parent (only active relationships)
    const parentIds = parents.map(p => p.id)
    const { data: links } = await supabase
      .from('parent_student_links')
      .select(`
        parent_id,
        student_id,
        relationship,
        relation_type,
        student:students(
          id,
          student_number,
          grade_level,
          profile:profiles(
            first_name,
            last_name
          )
        )
      `)
      .in('parent_id', parentIds)
      .eq('is_active', true)

    // Map children to parents
    const parentsWithChildren = parents.map(parent => {
      const children = links
        ?.filter((link: any) => link.parent_id === parent.id)
        .map((link: any) => ({
          id: link.student?.id || '',
          student_id: link.student_id,
          student_number: link.student?.student_number || '',
          grade_level: link.student?.grade_level || null,
          profile: link.student?.profile,
          relationship: link.relationship,
          relation_type: link.relation_type
        })) || []

      return {
        ...parent,
        children
      }
    })

    // If no query, return all parents
    if (!query || query.trim() === '') {
      return parentsWithChildren
    }

    // Filter in memory
    const queryLower = query.toLowerCase()
    return parentsWithChildren.filter(parent => {
      const profile: any = parent.profile
      if (!profile) return false

      return (
        profile.first_name?.toLowerCase().includes(queryLower) ||
        profile.last_name?.toLowerCase().includes(queryLower) ||
        profile.email?.toLowerCase().includes(queryLower) ||
        profile.phone?.includes(query) ||
        parent.id.toLowerCase().includes(queryLower)
      )
    })
  }

  /**
   * Get all fees for parent's children
   * Used in parent portal to view children's fee status
   */
  async getChildrenFees(parentId: string, schoolId: string) {
    // Get all children first
    const children = await this.getParentChildren(parentId, schoolId)
    if (!children || children.length === 0) {
      return { children: [], totalDue: 0, totalOverdue: 0, fees: [] }
    }

    const studentIds = children.map((c: any) => c.id || c.student_id)

    // Get fees for all children
    const { data: fees, error } = await supabase
      .from('student_fees')
      .select(`
        *,
        student:students(
          id,
          student_number,
          grade_level,
          profile:profiles(first_name, last_name)
        ),
        fee_structure:fee_structures(
          name,
          category:fee_categories(name, code)
        )
      `)
      .eq('school_id', schoolId)
      .in('student_id', studentIds)
      .order('due_date', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch children fees: ${error.message}`)
    }

    // Calculate totals
    const totalDue = fees?.reduce((sum: number, f: any) => sum + (f.balance || 0), 0) || 0
    const overdueItems = fees?.filter((f: any) =>
      f.status === 'overdue' || (f.balance > 0 && new Date(f.due_date) < new Date())
    ) || []
    const totalOverdue = overdueItems.reduce((sum: number, f: any) => sum + (f.balance || 0), 0)

    return {
      fees: fees || [],
      children: children.map((c: any) => ({
        id: c.id || c.student_id,
        name: `${c.profile?.first_name || ''} ${c.profile?.last_name || ''}`.trim(),
        grade_level: c.grade_level,
        fees: fees?.filter((f: any) => f.student_id === (c.id || c.student_id)) || []
      })),
      totalDue,
      totalOverdue
    }
  }

  /**
   * Get library data for parent's children
   * Includes active loans, overdue books, and unpaid fines
   */
  async getChildrenLibraryData(parentId: string, schoolId: string) {
    // Get all children first
    const children = await this.getParentChildren(parentId, schoolId)
    if (!children || children.length === 0) {
      return { children: [], totalFines: 0, overdueCount: 0, loans: [], fines: [] }
    }

    const studentIds = children.map((c: any) => c.id || c.student_id)

    // Get active loans
    const { data: loans, error: loansError } = await supabase
      .from('book_loans')
      .select(`
        *,
        student:students(
          id,
          student_number,
          profile:profiles(first_name, last_name)
        ),
        book_copy:book_copies(
          accession_number,
          book:library_books(title, author, isbn)
        )
      `)
      .eq('school_id', schoolId)
      .in('student_id', studentIds)
      .in('status', ['active', 'overdue'])
      .order('due_date', { ascending: true })

    if (loansError) {
      throw new Error(`Failed to fetch children loans: ${loansError.message}`)
    }

    // Get unpaid fines
    const { data: fines, error: finesError } = await supabase
      .from('library_fines')
      .select(`
        *,
        loan:book_loans(
          student:students(
            id,
            profile:profiles(first_name, last_name)
          ),
          book_copy:book_copies(
            book:library_books(title)
          )
        )
      `)
      .eq('school_id', schoolId)
      .eq('is_paid', false)

    if (finesError) {
      throw new Error(`Failed to fetch children fines: ${finesError.message}`)
    }

    // Filter fines to only those belonging to parent's children
    const childFines = fines?.filter((f: any) =>
      studentIds.includes(f.loan?.student?.id)
    ) || []

    // Calculate totals
    const overdueLoans = loans?.filter((l: any) =>
      l.status === 'overdue' || new Date(l.due_date) < new Date()
    ) || []
    const totalFines = childFines.reduce((sum: number, f: any) => sum + (f.amount || 0), 0)

    return {
      loans: loans || [],
      fines: childFines,
      children: children.map((c: any) => ({
        id: c.id || c.student_id,
        name: `${c.profile?.first_name || ''} ${c.profile?.last_name || ''}`.trim(),
        loans: loans?.filter((l: any) => l.student_id === (c.id || c.student_id)) || [],
        fines: childFines.filter((f: any) => f.loan?.student?.id === (c.id || c.student_id))
      })),
      totalFines,
      overdueCount: overdueLoans.length
    }
  }
}
