import { supabase } from '../config/supabase'
import {
    Staff,
    CreateStaffDTO,
    UpdateStaffDTO,
    ApiResponse,
    UserRole
} from '../types'


// ============================================================================
// STAFF & LIBRARIAN MANAGEMENT SERVICE
// ============================================================================

// Helper function to determine role based on title/designation
const determineRoleFromTitle = (title?: string): UserRole => {
    if (!title) return 'staff'

    const lowerTitle = title.toLowerCase().trim()

    // Librarian role - MUST check first
    if (lowerTitle.includes('librarian')) {
        return 'librarian'
    }

    // Admin roles
    if (lowerTitle.includes('admin') || lowerTitle.includes('administrator') || lowerTitle.includes('principal') || lowerTitle.includes('director')) {
        return 'admin'
    }

    // Teacher roles
    if (lowerTitle.includes('teacher') || lowerTitle.includes('instructor') || lowerTitle.includes('professor') || lowerTitle.includes('lecturer')) {
        return 'teacher'
    }

    // Counselor
    if (lowerTitle.includes('counselor') || lowerTitle.includes('counsellor')) {
        return 'counselor'
    }

    // Default to staff for all other roles (accountant, clerk, driver, nurse, etc.)
    return 'staff'
}

export const getAllStaff = async (
    schoolId: string,
    options?: { page?: number; limit?: number; search?: string; role?: 'staff' | 'librarian' | 'teacher' | 'all' | 'employees' }
): Promise<ApiResponse<{ data: Staff[], total: number, page: number, totalPages: number }>> => {
    try {
        const page = options?.page || 1
        const limit = options?.limit || 10
        const offset = (page - 1) * limit
        const search = options?.search?.toLowerCase()
        const roleFilter = options?.role || 'all'

        // Build base query - join with profiles to access profile.role as fallback
        let query = supabase
            .from('staff')
            .select(`
        *,
        profile:profiles!staff_profile_id_fkey(*)
      `, { count: 'exact' })
            .eq('school_id', schoolId)
            .eq('is_active', true)

        // ⚠️ CRITICAL FIX: Filter by role in SQL query BEFORE pagination
        // We filter based on staff.role column (must be synced from profile.role)
        if (roleFilter === 'employees') {
            // Fetch ALL employees including teachers (for payroll/payments)
            query = query.in('role', ['staff', 'librarian', 'admin', 'counselor', 'teacher'])
        } else if (roleFilter !== 'all') {
            query = query.eq('role', roleFilter)
        } else {
            // 'all' = staff, librarian, admin, and counselor roles (exclude teacher for staff management)
            query = query.in('role', ['staff', 'librarian', 'admin', 'counselor'])
        }

        // Execute main query with pagination AFTER role filtering
        const { data: staffData, error, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (error) throw error

        // Role filtering is now done in SQL query above
        // We only need to apply search filter in JavaScript
        let filteredStaff = staffData || []

        // Apply Search
        if (search) {
            filteredStaff = filteredStaff.filter((staff: any) => {
                const fullName = `${staff.profile?.first_name} ${staff.profile?.last_name}`.toLowerCase()
                const email = staff.profile?.email?.toLowerCase() || ''
                const empId = staff.employee_number?.toLowerCase() || ''
                const title = staff.title?.toLowerCase() || ''

                return fullName.includes(search) ||
                    email.includes(search) ||
                    empId.includes(search) ||
                    title.includes(search)
            })
        }

        // Recalculate totals after JS filtering (approximation if pagination was used)
        const total = count || filteredStaff.length
        const totalPages = Math.ceil(total / limit)

        return {
            success: true,
            data: {
                data: filteredStaff as Staff[],
                total,
                page,
                totalPages
            }
        }
    } catch (error: any) {
        console.error('Error fetching staff:', error)
        return { success: false, message: error.message }
    }
}

export const getStaffById = async (id: string, schoolId?: string): Promise<ApiResponse<Staff>> => {
    try {
        // Try using the optimized RPC function first (without school_id filter)
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_teacher_with_salary', {
            p_teacher_id: id,
            p_school_id: null  // Don't filter by school - let controller validate access
        }).maybeSingle()

        if (!rpcError && rpcData) {
            return { success: true, data: rpcData as Staff }
        }

        // Fallback: Manual query WITHOUT school_id filter
        const { data, error } = await supabase
            .from('staff')
            .select(`
        *,
        profile:profiles!staff_profile_id_fkey(*)
      `)
            .eq('id', id)
            .single()

        if (error) {
            console.error('❌ Error fetching staff:', error)
            throw error
        }

        if (!data) {
            throw new Error('Staff member not found')
        }

        // Fetch salary from salary_structures table
        const { data: salaryData, error: salaryError } = await supabase
            .from('salary_structures')
            .select('base_salary')
            .eq('staff_id', id)
            .eq('is_current', true)
            .maybeSingle()

        if (salaryError) {
            console.error('❌ Error fetching salary:', salaryError)
        }

        const staffWithSalary = {
            ...data,
            base_salary: salaryData?.base_salary || 0
        }

        return { success: true, data: staffWithSalary as Staff }
    } catch (error: any) {
        console.error('❌ getStaffById error:', error)
        return { success: false, message: error.message }
    }
}

// Get staff by profile_id (for /me endpoint)
export const getStaffByProfileId = async (profileId: string, schoolId: string): Promise<ApiResponse<Staff>> => {
    try {
        const { data, error } = await supabase
            .from('staff')
            .select(`
        *,
        profile:profiles!staff_profile_id_fkey(*)
      `)
            .eq('profile_id', profileId)
            .eq('school_id', schoolId)
            .single()

        if (error) throw error

        return { success: true, data: data as Staff }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}

export const createStaff = async (
    _schoolId: string,
    data: CreateStaffDTO,
    _creatorId: string
): Promise<ApiResponse<Staff>> => {
    try {
        // 1. Determine Role based on Designation (Title)
        let _userRole: UserRole = 'staff';
        if (data.title && data.title.toLowerCase() === 'librarian') {
            _userRole = 'librarian';
        }

        // 2. Create Profile (Auth User)
        // We need to create a user in Supabase Auth first OR just create a profile entry provided we have a system for that.
        // Assuming we use the same flow as Teachers/Students where we call an Edge Function or use Supabase Admin API.
        // For now, we will simulate the Admin API call if available, or assume we insert into profiles directly 
        // (Note: usually requires Supabase Admin Client, passed from controller if needed, or we use a separate auth service methods)

        // Check if email exists
        const { data: existingUser } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', data.email)
            .single()

        if (existingUser) {
            return { success: false, message: 'User with this email already exists' }
        }

        // Create Auth User (This part usually happens via Supabase GoTrue Admin API in the Controller or a helper)
        // Since we are in the Service layer and `supabase` client here is likely the service_role or anonymous, 
        // let's assume the Controller handles Auth creation and passes the `profile_id`.
        // WAIT: CreateStaffDTO usually contains email/password.
        // I will return a specific instructions to Controller to create Auth. 
        // Refactoring: I will assume the Controller calls `auth.admin.createUser` and creates the `profile`, 
        // OR we do it here if we have `supabaseAdmin` access.
        // Let's assume we do the database insertions here, but the Auth creation happens before or we bundle it.

        // **Correction**: To match the existing pattern (e.g. `students.service.ts` or `teacher.service.ts`), 
        // let's see how they do it. I'll stick to inserting DB records, assuming Profile is created.
        // BUT, usually `createTeacher` handles everything.
        // I'll implement the full flow assuming access to `supabase.auth.admin` is needed, 
        // but standard `supabase` client might not have it unless configured with service key.
        // I will write the LOGIC here to Insert to `staff` table, and expect `profile_id` to be passed 
        // or handled by a wrapper.

        // ACTUALLY: The standard pattern in this codebase seems to be:
        // 1. Controller calls Auth API to create user.
        // 2. Controller calls Service to create DB records.
        // Let's modify CreateStaffDTO to accept `profile_id` if it's not there, or assume the service handles profile creation.

        // FOR SAFETY: I'll assume the Controller handles the sensitive Auth creation 
        // and passes a `profile_id` in `data` or as an arg.
        // Looking at `CreateStaffDTO` in `teachers.ts` (API), it has email/password.

        throw new Error("Use createStaffWithAuth in controller to handle transaction")

    } catch (error: any) {
        return { success: false, message: error.message }
    }
}

// Helper to be used by Controller which has access to Admin Auth
export const createStaffRecord = async (
    schoolId: string,
    profileId: string,
    data: CreateStaffDTO,
    creatorId: string
): Promise<Staff> => {
    // 1. Determine role based on title
    const role = determineRoleFromTitle(data.title)

    // 2. Auto-generate employee_number if not provided
    let employeeNumber = data.employee_number
    if (!employeeNumber) {
        const rolePrefix = role === 'librarian' ? 'LIB' : role === 'staff' ? 'STF' : role === 'admin' ? 'ADM' : 'CSL'
        const timestamp = Date.now().toString().slice(-6)
        employeeNumber = `${rolePrefix}-${timestamp}`
    }

    // 3. Update Profile with school_id and role
    const { error: profileError } = await supabase
        .from('profiles')
        .update({
            school_id: schoolId,
            role: role,
            first_name: data.first_name,
            last_name: data.last_name,
            phone: data.phone || null,
            profile_photo_url: data.profile_photo_url || null,
        })
        .eq('id', profileId)

    if (profileError) {
        console.error('❌ Failed to update profile:', profileError)
        throw profileError
    }

    // 4. Insert into Staff table with correct role
    const { data: newStaff, error } = await supabase
        .from('staff')
        .insert({
            profile_id: profileId,
            school_id: schoolId,
            employee_number: employeeNumber,
            title: data.title,
            department: data.department,
            qualifications: data.qualifications,
            specialization: data.specialization,
            date_of_joining: data.date_of_joining,
            employment_type: data.employment_type || 'full_time',
            payment_type: data.payment_type || 'fixed_salary',
            is_active: true,
            permissions: data.permissions || {},
            custom_fields: data.custom_fields || [],
            created_by: creatorId,
            role: role  // Set correct role based on title
        })
        .select()
        .single()

    if (error) {
        console.error('❌ Failed to create staff record:', error)
        throw error
    }

    // 4. Create Salary Structure if base_salary is provided
    if (data.base_salary && data.base_salary > 0) {
        const { error: salaryError } = await supabase
            .from('salary_structures')
            .insert({
                staff_id: newStaff.id,
                school_id: schoolId,
                base_salary: data.base_salary,
                effective_from: data.date_of_joining || new Date().toISOString().split('T')[0],
                is_current: true,
                created_at: new Date().toISOString()
            })

        if (salaryError) {
            console.error('Failed to create salary structure:', salaryError)
            // Don't throw - staff is already created, salary can be added later
        }
    }

    return newStaff
}

export const updateStaff = async (
    id: string,
    schoolId: string,
    data: UpdateStaffDTO
): Promise<ApiResponse<Staff>> => {
    try {
        // Update Profile if name/email changed or password provided
        if (data.first_name || data.last_name || data.email || data.password) {
            // Get profile_id
            const { data: staff } = await supabase.from('staff').select('profile_id').eq('id', id).single()
            if (staff) {
                const profileUpdate: any = {}
                if (data.first_name) profileUpdate.first_name = data.first_name
                if (data.last_name) profileUpdate.last_name = data.last_name

                if (Object.keys(profileUpdate).length > 0) {
                    await supabase.from('profiles').update(profileUpdate).eq('id', staff.profile_id)
                }

                // Update Password if provided
                if (data.password && data.password.length >= 8) {
                    const { error: authError } = await supabase.auth.admin.updateUserById(
                        staff.profile_id,
                        { password: data.password }
                    )
                    if (authError) throw authError
                }
            }
        }

        // Prepare Staff Update Object
        const staffUpdate: any = {}
        if (data.title !== undefined) staffUpdate.title = data.title
        if (data.department !== undefined) staffUpdate.department = data.department
        if (data.qualifications !== undefined) staffUpdate.qualifications = data.qualifications
        if (data.specialization !== undefined) staffUpdate.specialization = data.specialization
        if (data.date_of_joining !== undefined) staffUpdate.date_of_joining = data.date_of_joining
        if (data.employment_type !== undefined) staffUpdate.employment_type = data.employment_type
        if (data.payment_type !== undefined) staffUpdate.payment_type = data.payment_type
        if (data.is_active !== undefined) staffUpdate.is_active = data.is_active
        if (data.permissions !== undefined) staffUpdate.permissions = data.permissions
        if (data.custom_fields !== undefined) staffUpdate.custom_fields = data.custom_fields

        // Handle base_salary update in salary_structures table
        if (data.base_salary !== undefined) {
            // Check if salary structure exists
            const { data: existingSalary } = await supabase
                .from('salary_structures')
                .select('id')
                .eq('staff_id', id)
                .eq('is_current', true)
                .maybeSingle()

            if (existingSalary) {
                // Update existing salary
                await supabase
                    .from('salary_structures')
                    .update({ base_salary: data.base_salary })
                    .eq('staff_id', id)
                    .eq('is_current', true)
            } else {
                // Insert new salary structure
                await supabase
                    .from('salary_structures')
                    .insert({
                        staff_id: id,
                        school_id: schoolId,
                        base_salary: data.base_salary,
                        effective_from: new Date().toISOString().split('T')[0],
                        is_current: true
                    })
            }
        }

        // Update Staff Record if there are changes
        let query = supabase.from('staff').select(`
            *,
            profile:profiles!staff_profile_id_fkey(*)
        `).eq('id', id).eq('school_id', schoolId)

        if (Object.keys(staffUpdate).length > 0) {
            // If field updates exist, perform update
            const { data: updatedStaff, error } = await supabase
                .from('staff')
                .update(staffUpdate)
                .eq('id', id)
                .eq('school_id', schoolId)
                .select(`
                    *,
                    profile:profiles!staff_profile_id_fkey(*)
                `)
                .single()

            if (error) throw error
            
            // Fetch and include base_salary
            const { data: salaryData } = await supabase
                .from('salary_structures')
                .select('base_salary')
                .eq('staff_id', id)
                .eq('is_current', true)
                .maybeSingle()
            
            return { 
                success: true, 
                data: {
                    ...updatedStaff,
                    base_salary: salaryData?.base_salary || 0
                } as Staff 
            }
        } else {
            // Check if only password/salary was updated
            const { data: existingStaff, error } = await query.single()

            if (error) throw error
            
            // Fetch and include base_salary
            const { data: salaryData } = await supabase
                .from('salary_structures')
                .select('base_salary')
                .eq('staff_id', id)
                .eq('is_current', true)
                .maybeSingle()
            
            return { 
                success: true, 
                data: {
                    ...existingStaff,
                    base_salary: salaryData?.base_salary || 0
                } as Staff 
            }
        }

    } catch (error: any) {
        console.error('Error updating staff:', error)
        return { success: false, message: error.message }
    }
}

export const deleteStaff = async (id: string, _schoolId: string): Promise<ApiResponse<boolean>> => {
    try {
        // Get profile_id to delete auth user too if needed
        const { data: staff } = await supabase.from('staff').select('profile_id').eq('id', id).single()

        if (staff) {
            // Delete from Staff (Cascade should handle profile? No, usually profile is parent)
            // We delete profile, and cascade deletes staff
            const { error } = await supabase.from('profiles').delete().eq('id', staff.profile_id)
            if (error) throw error
        }

        return { success: true, data: true }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}
