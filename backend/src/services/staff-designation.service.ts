import { supabase } from '../config/supabase'
import { ApiResponse } from '../types'

export interface StaffDesignation {
    id: string
    school_id: string
    campus_id: string | null
    name: string
    description: string | null
    is_system: boolean
    is_active: boolean
    created_at: string
    updated_at: string
    created_by: string | null
}

export interface CreateDesignationDTO {
    name: string
    campus_id?: string | null
    description?: string
    is_system?: boolean
}

export interface UpdateDesignationDTO {
    name?: string
    description?: string
    is_active?: boolean
}

/**
 * Get all designations for a school (includes school-wide and campus-specific)
 */
export async function getDesignations(
    schoolId: string,
    campusId?: string
): Promise<ApiResponse<StaffDesignation[]>> {
    try {
        let query = supabase
            .from('staff_designations')
            .select('*')
            .eq('is_active', true)
            .order('is_system', { ascending: false })
            .order('name', { ascending: true })

        if (campusId) {
            // Get campus-specific AND school-wide designations
            query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
                .eq('school_id', schoolId)
        } else {
            // Get only school-wide designations
            query = query.eq('school_id', schoolId)
                .is('campus_id', null)
        }

        const { data, error } = await query

        if (error) throw error

        return { success: true, data: data || [] }
    } catch (error: any) {
        console.error('Error fetching designations:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Get all designations for a school grouped by campus
 */
export async function getAllDesignationsGrouped(
    schoolId: string
): Promise<ApiResponse<{ schoolWide: StaffDesignation[], byCampus: Record<string, StaffDesignation[]> }>> {
    try {
        const { data, error } = await supabase
            .from('staff_designations')
            .select('*')
            .eq('school_id', schoolId)
            .eq('is_active', true)
            .order('is_system', { ascending: false })
            .order('name', { ascending: true })

        if (error) throw error

        const schoolWide = (data || []).filter(d => !d.campus_id)
        const byCampus: Record<string, StaffDesignation[]> = {}

        for (const designation of data || []) {
            if (designation.campus_id) {
                if (!byCampus[designation.campus_id]) {
                    byCampus[designation.campus_id] = []
                }
                byCampus[designation.campus_id].push(designation)
            }
        }

        return { success: true, data: { schoolWide, byCampus } }
    } catch (error: any) {
        console.error('Error fetching grouped designations:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Create a new designation
 */
export async function createDesignation(
    schoolId: string,
    dto: CreateDesignationDTO,
    createdBy?: string
): Promise<ApiResponse<StaffDesignation>> {
    try {
        const { data, error } = await supabase
            .from('staff_designations')
            .insert({
                school_id: schoolId,
                campus_id: dto.campus_id || null,
                name: dto.name.trim(),
                description: dto.description || null,
                is_system: dto.is_system || false,
                created_by: createdBy || null
            })
            .select()
            .single()

        if (error) {
            // Handle unique constraint violation
            if (error.code === '23505') {
                throw new Error('A designation with this name already exists')
            }
            throw error
        }

        return { success: true, data }
    } catch (error: any) {
        console.error('Error creating designation:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Update a designation
 */
export async function updateDesignation(
    designationId: string,
    dto: UpdateDesignationDTO
): Promise<ApiResponse<StaffDesignation>> {
    try {
        // First check if it's a system designation
        const { data: existing, error: fetchError } = await supabase
            .from('staff_designations')
            .select('is_system')
            .eq('id', designationId)
            .single()

        if (fetchError) throw fetchError
        
        if (existing?.is_system && dto.name) {
            throw new Error('Cannot rename system designations')
        }

        const updateData: any = {}
        if (dto.name !== undefined) updateData.name = dto.name.trim()
        if (dto.description !== undefined) updateData.description = dto.description
        if (dto.is_active !== undefined) updateData.is_active = dto.is_active

        const { data, error } = await supabase
            .from('staff_designations')
            .update(updateData)
            .eq('id', designationId)
            .select()
            .single()

        if (error) {
            if (error.code === '23505') {
                throw new Error('A designation with this name already exists')
            }
            throw error
        }

        return { success: true, data }
    } catch (error: any) {
        console.error('Error updating designation:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Delete a designation (soft delete by setting is_active = false for system, hard delete otherwise)
 */
export async function deleteDesignation(
    designationId: string
): Promise<ApiResponse<void>> {
    try {
        // First check if it's a system designation
        const { data: existing, error: fetchError } = await supabase
            .from('staff_designations')
            .select('is_system')
            .eq('id', designationId)
            .single()

        if (fetchError) throw fetchError
        
        if (existing?.is_system) {
            throw new Error('Cannot delete system designations')
        }

        const { error } = await supabase
            .from('staff_designations')
            .delete()
            .eq('id', designationId)

        if (error) throw error

        return { success: true, data: undefined }
    } catch (error: any) {
        console.error('Error deleting designation:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Seed default designations for a school
 */
export async function seedDefaultDesignations(
    schoolId: string,
    createdBy?: string
): Promise<ApiResponse<StaffDesignation[]>> {
    try {
        const defaultDesignations = [
            { name: 'Librarian', is_system: true },
            { name: 'Accountant', is_system: false },
            { name: 'Clerk', is_system: false },
            { name: 'Driver', is_system: false },
            { name: 'Security Guard', is_system: false },
            { name: 'Nurse', is_system: false },
            { name: 'Receptionist', is_system: false }
        ]

        const insertData = defaultDesignations.map(d => ({
            school_id: schoolId,
            campus_id: null,
            name: d.name,
            is_system: d.is_system,
            created_by: createdBy || null
        }))

        const { data, error } = await supabase
            .from('staff_designations')
            .upsert(insertData, { 
                onConflict: 'school_id,campus_id,name',
                ignoreDuplicates: true 
            })
            .select()

        if (error) throw error

        return { success: true, data: data || [] }
    } catch (error: any) {
        console.error('Error seeding designations:', error)
        return { success: false, error: error.message }
    }
}
