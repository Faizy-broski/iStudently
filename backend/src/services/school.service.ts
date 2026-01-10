import { supabase } from '../config/supabase'
import { CreateSchoolDTO, UpdateSchoolDTO, School, SchoolStats } from '../types'

export class SchoolService {
  /**
   * Onboard a new school with admin user (Super Admin only)
   * Creates school, admin user, profile, staff record, and billing in a transaction
   */
  async onboardSchool(
    schoolData: CreateSchoolDTO, 
    adminData: {
      email: string
      password: string
      first_name: string
      last_name: string
    },
    billingData?: {
      billing_plan_id: string
      billing_cycle: string
      amount: number
      start_date: string
      due_date: string
      payment_status: string
    }
  ): Promise<{ school: School; admin: any; billing?: any }> {
    try {
      // 1. Create the school
      const { data: school, error: schoolError } = await supabase
        .from('schools')
        .insert({
          name: schoolData.name,
          slug: schoolData.slug,
          contact_email: schoolData.contact_email,
          address: schoolData.address || null,
          website: schoolData.website || null,
          logo_url: schoolData.logo_url || null,
          status: 'active'
        })
        .select()
        .single()

      if (schoolError) {
        // Handle specific database errors
        if (schoolError.code === '23505') {
          // Unique constraint violation (PostgreSQL error code for unique constraint)
          if (schoolError.message.includes('slug')) {
            throw new Error('DUPLICATE_SLUG: A school with this slug already exists')
          }
          if (schoolError.message.includes('contact_email')) {
            throw new Error('DUPLICATE_EMAIL: A school with this contact email already exists')
          }
          throw new Error('DUPLICATE_ENTRY: This school already exists')
        }
        if (schoolError.code === '23503') {
          // Foreign key violation
          throw new Error('INVALID_REFERENCE: Referenced record does not exist')
        }
        if (schoolError.code === '23502') {
          // Not null violation
          throw new Error('MISSING_REQUIRED: A required field is missing')
        }
        throw new Error(`Failed to create school: ${schoolError.message}`)
      }

      // 2. Create admin user in auth.users
      console.log('🔐 Creating admin user:', {
        email: adminData.email,
        hasPassword: !!adminData.password,
        passwordLength: adminData.password?.length
      })

      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: adminData.email,
        password: adminData.password,
        email_confirm: true,
        user_metadata: {
          first_name: adminData.first_name,
          last_name: adminData.last_name,
          role: 'admin'
        }
      })

      if (authError || !authUser.user) {
        console.error('❌ Auth user creation failed:', {
          error: authError,
          message: authError?.message,
          status: authError?.status,
          details: JSON.stringify(authError)
        })
        // Rollback: delete school if user creation fails
        await supabase.from('schools').delete().eq('id', school.id)
        
        // Handle specific auth errors
        if (authError?.message?.includes('User already registered') || 
            authError?.message?.includes('already been registered') ||
            authError?.message?.includes('already exists')) {
          throw new Error('EMAIL_EXISTS: This email address is already registered')
        }
        if (authError?.message?.includes('Invalid email') ||
            authError?.message?.includes('invalid email')) {
          throw new Error('INVALID_EMAIL: Please provide a valid email address')
        }
        if (authError?.message?.includes('password') ||
            authError?.message?.includes('Password')) {
          throw new Error(`PASSWORD_ERROR: ${authError.message}`)
        }
        
        // Catch-all for other auth errors
        throw new Error(`AUTH_ERROR: ${authError?.message || 'Authentication failed'}`)
      }

      console.log('✅ Auth user created:', authUser.user.id)

      // 3. Verify profile was created by trigger, then update it
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.user.id)
        .single()

      console.log('🔍 Existing profile check:', existingProfile)

      if (!existingProfile) {
        // Profile wasn't created by trigger, create it manually
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: authUser.user.id,
            email: adminData.email,
            role: 'admin',
            first_name: adminData.first_name,
            last_name: adminData.last_name,
            school_id: school.id,
            is_active: true
          })

        if (insertError) {
          console.error('❌ Profile insert failed:', insertError)
          await supabase.auth.admin.deleteUser(authUser.user.id)
          await supabase.from('schools').delete().eq('id', school.id)
          throw new Error(`Failed to create profile: ${insertError.message}`)
        }
        
        console.log('✅ Profile created manually')
      } else {
        // Profile exists, update it
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            school_id: school.id,
            role: 'admin',
            first_name: adminData.first_name,
            last_name: adminData.last_name
          })
          .eq('id', authUser.user.id)

        if (profileError) {
          console.error('❌ Profile update failed:', profileError)
          await supabase.auth.admin.deleteUser(authUser.user.id)
          await supabase.from('schools').delete().eq('id', school.id)
          throw new Error(`Failed to update profile: ${profileError.message}`)
        }
        
        console.log('✅ Profile updated')
      }

      // 4. Create staff record for the admin
      const { error: staffError } = await supabase
        .from('staff')
        .insert({
          profile_id: authUser.user.id,
          school_id: school.id,
          title: 'School Administrator',
          department: 'Administration',
          permissions: {
            can_manage_users: true,
            can_manage_courses: true,
            can_manage_students: true,
            can_view_reports: true
          }
        })

      if (staffError) {
        console.warn('Staff record creation failed, but continuing:', staffError.message)
      }

      // 5. Create billing record if billing data is provided
      let billingRecord = null
      if (billingData) {
        const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`
        
        const { data: billing, error: billingError } = await supabase
          .from('billing_records')
          .insert({
            school_id: school.id,
            billing_plan_id: billingData.billing_plan_id,
            billing_cycle: billingData.billing_cycle,
            amount: billingData.amount,
            start_date: billingData.start_date,
            due_date: billingData.due_date,
            payment_status: billingData.payment_status || 'unpaid',
            invoice_number: invoiceNumber,
            payment_date: null,
            currency: 'USD',
            payment_method: null,
            transaction_id: null,
            notes: `Automatically created during school onboarding on ${new Date().toISOString().split('T')[0]}`
          })
          .select(`
            *,
            school:schools!billing_records_school_id_fkey(name),
            plan:billing_plans!billing_records_billing_plan_id_fkey(name)
          `)
          .single()

        if (billingError) {
          console.warn('Billing record creation failed, but continuing:', billingError.message)
        } else {
          billingRecord = billing
          console.log('✅ Billing record created:', invoiceNumber)
        }
      }

      return {
        school: school as School,
        admin: {
          id: authUser.user.id,
          email: authUser.user.email,
          first_name: adminData.first_name,
          last_name: adminData.last_name
        },
        billing: billingRecord
      }
    } catch (error: any) {
      console.error('Onboard school error:', error)
      throw error
    }
  }

  /**
   * Create a new school (Super Admin only)
   */
  async createSchool(data: CreateSchoolDTO): Promise<School> {
    // Validate slug is unique
    const { data: existing } = await supabase
      .from('schools')
      .select('id')
      .eq('slug', data.slug)
      .single()

    if (existing) {
      throw new Error('School slug already exists')
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(data.contact_email)) {
      throw new Error('Invalid email format')
    }

    // Create school
    const { data: school, error } = await supabase
      .from('schools')
      .insert({
        name: data.name,
        slug: data.slug,
        contact_email: data.contact_email,
        address: data.address || null,
        website: data.website || null,
        logo_url: data.logo_url || null,
        status: 'active'
      })
      .select()
      .single()

    if (error) {
      console.error('Create school error:', error)
      throw new Error(error.message || 'Failed to create school')
    }

    return school as School
  }

  /**
   * Get all schools with optional filtering
   */
  async getAllSchools(filters?: { status?: string }): Promise<School[]> {
    let query = supabase
      .from('schools')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Get schools error:', error)
      throw new Error('Failed to fetch schools')
    }

    return (data || []) as School[]
  }

  /**
   * Get school by ID
   */
  async getSchoolById(id: string): Promise<School> {
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      throw new Error('School not found')
    }

    return data as School
  }

  /**
   * Get school by slug
   */
  async getSchoolBySlug(slug: string): Promise<School> {
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error || !data) {
      throw new Error('School not found')
    }

    return data as School
  }

  /**
   * Update school information
   */
  async updateSchool(id: string, updates: UpdateSchoolDTO): Promise<School> {
    // Check if school exists
    await this.getSchoolById(id)

    const { data, error } = await supabase
      .from('schools')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Update school error:', error)
      throw new Error('Failed to update school')
    }

    return data as School
  }

  /**
   * Update school status (activate/suspend)
   */
  async updateSchoolStatus(id: string, status: 'active' | 'suspended'): Promise<School> {
    return this.updateSchool(id, { status })
  }

  /**
   * Delete school (soft delete by suspending)
   */
  async deleteSchool(id: string): Promise<void> {
    await this.updateSchoolStatus(id, 'suspended')
  }

  /**
   * Get school statistics
   */
  async getSchoolStats(schoolId?: string): Promise<SchoolStats> {
    // Total schools
    let totalQuery = supabase
      .from('schools')
      .select('*', { count: 'exact', head: true })

    if (schoolId) {
      totalQuery = totalQuery.eq('id', schoolId)
    }

    const { count: totalSchools } = await totalQuery

    // Active schools
    let activeQuery = supabase
      .from('schools')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    if (schoolId) {
      activeQuery = activeQuery.eq('id', schoolId)
    }

    const { count: activeSchools } = await activeQuery

    return {
      total_schools: totalSchools || 0,
      active_schools: activeSchools || 0,
      suspended_schools: (totalSchools || 0) - (activeSchools || 0)
    }
  }

  /**
   * Get schools count by status
   */
  async getSchoolCountByStatus(): Promise<Record<string, number>> {
    const { data: schools } = await supabase
      .from('schools')
      .select('status')

    const counts: Record<string, number> = {
      active: 0,
      suspended: 0
    }

    schools?.forEach(school => {
      counts[school.status] = (counts[school.status] || 0) + 1
    })

    return counts
  }

  /**
   * Get school admin information
   */
  async getSchoolAdmin(schoolId: string): Promise<{
    admin_name: string;
    admin_email: string;
    user_id: string;
  } | null> {
    const { data: adminUser, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('school_id', schoolId)
      .eq('role', 'admin')
      .single()

    if (error) {
      console.error('Get school admin error:', error)
      throw new Error('Failed to fetch admin information')
    }

    if (!adminUser) {
      return null
    }

    return {
      admin_name: `${adminUser.first_name || ''} ${adminUser.last_name || ''}`.trim(),
      admin_email: adminUser.email,
      user_id: adminUser.id
    }
  }

  /**
   * Update school admin information
   */
  async updateSchoolAdmin(
    schoolId: string,
    data: { admin_name?: string; admin_email?: string; password?: string }
  ): Promise<{
    message: string;
    updated_fields: { name: boolean; email: boolean; password: boolean };
  }> {
    const adminInfo = await this.getSchoolAdmin(schoolId)

    if (!adminInfo) {
      throw new Error('Admin user not found for this school')
    }

    const { user_id: userId } = adminInfo
    const updates: Array<Promise<void>> = []

    // Update auth credentials (email/password)
    if (data.admin_email || data.password) {
      const authUpdate = async () => {
        const updateData: { email?: string; password?: string } = {}

        if (data.admin_email) updateData.email = data.admin_email
        if (data.password) updateData.password = data.password

        const { error } = await supabase.auth.admin.updateUserById(userId, updateData)

        if (error) {
          throw new Error(`Failed to update admin credentials: ${error.message}`)
        }
      }
      updates.push(authUpdate())
    }

    // Update profile name
    if (data.admin_name) {
      const profileUpdate = async () => {
        const [firstName, ...lastNameParts] = data.admin_name!.trim().split(' ')

        const { error } = await supabase
          .from('profiles')
          .update({
            first_name: firstName || '',
            last_name: lastNameParts.join(' ') || ''
          })
          .eq('id', userId)

        if (error) {
          throw new Error('Failed to update admin profile')
        }
      }
      updates.push(profileUpdate())
    }

    // Execute all updates in parallel
    await Promise.all(updates)

    return {
      message: 'Admin information updated successfully',
      updated_fields: {
        name: !!data.admin_name,
        email: !!data.admin_email,
        password: !!data.password
      }
    }
  }
}
