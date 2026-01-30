import { supabase } from '../config/supabase'

export interface SetupStatus {
    hasCampuses: boolean
    hasAcademicYear: boolean
    isComplete: boolean
    campusCount: number
    academicYearCount: number
}

class SetupStatusService {
    /**
     * Check if a school has completed the required setup
     * A school is considered "setup complete" when it has:
     * - At least one campus (branch school)
     * - At least one academic year
     */
    async getSetupStatus(schoolId: string): Promise<SetupStatus> {
        // Check for campuses (branch schools with this school as parent)
        const { data: campuses, error: campusError } = await supabase
            .from('schools')
            .select('id')
            .eq('parent_school_id', schoolId)

        if (campusError) {
            console.error('Error checking campuses:', campusError)
            throw new Error('Failed to check campus status')
        }

        // Check for academic years
        const { data: academicYears, error: yearError } = await supabase
            .from('academic_years')
            .select('id')
            .eq('school_id', schoolId)

        if (yearError) {
            console.error('Error checking academic years:', yearError)
            throw new Error('Failed to check academic year status')
        }

        const campusCount = campuses?.length || 0
        const academicYearCount = academicYears?.length || 0
        const hasCampuses = campusCount > 0
        const hasAcademicYear = academicYearCount > 0

        return {
            hasCampuses,
            hasAcademicYear,
            isComplete: hasCampuses && hasAcademicYear,
            campusCount,
            academicYearCount
        }
    }

    /**
     * Create a new campus (branch school) under the parent school
     */
    async createCampus(parentSchoolId: string, campusData: {
        name: string
        address?: string
        contact_email?: string
    }): Promise<any> {
        // Generate a slug from the name
        const slug = campusData.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36)

        const { data, error } = await supabase
            .from('schools')
            .insert({
                name: campusData.name,
                slug,
                address: campusData.address || null,
                contact_email: campusData.contact_email || null,
                parent_school_id: parentSchoolId,
                status: 'active'
            })
            .select()
            .single()

        if (error) {
            console.error('Error creating campus:', error)
            throw new Error('Failed to create campus: ' + error.message)
        }

        return data
    }

    /**
     * Get all campuses for a school
     */
    async getCampuses(schoolId: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('schools')
            .select('*')
            .eq('parent_school_id', schoolId)
            .order('name')

        if (error) {
            console.error('Error fetching campuses:', error)
            throw new Error('Failed to fetch campuses')
        }

        return data || []
    }

    /**
     * Update a campus
     */
    async updateCampus(campusId: string, updates: {
        name?: string
        address?: string
        contact_email?: string
    }): Promise<any> {
        const { data, error } = await supabase
            .from('schools')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', campusId)
            .select()
            .single()

        if (error) {
            console.error('Error updating campus:', error)
            throw new Error('Failed to update campus')
        }

        return data
    }

    /**
     * Delete a campus (soft delete by setting status to suspended)
     */
    async deleteCampus(campusId: string): Promise<void> {
        const { error } = await supabase
            .from('schools')
            .update({
                status: 'suspended',
                updated_at: new Date().toISOString()
            })
            .eq('id', campusId)

        if (error) {
            console.error('Error deleting campus:', error)
            throw new Error('Failed to delete campus')
        }
    }
}

export const setupStatusService = new SetupStatusService()
