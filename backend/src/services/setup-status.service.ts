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

    /**
     * Get a specific campus by ID
     */
    async getCampusById(campusId: string): Promise<any> {
        const { data, error } = await supabase
            .from('schools')
            .select('*')
            .eq('id', campusId)
            .single()

        if (error) {
            console.error('Error fetching campus:', error)
            throw new Error('Failed to fetch campus')
        }

        return data
    }

    /**
     * Get campus statistics
     */
    async getCampusStats(campusId: string): Promise<{
        total_students: number
        total_teachers: number
        total_staff: number
        total_parents: number
        total_grade_levels: number
        total_sections: number
    }> {
        // Get student count
        const { count: studentCount } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('campus_id', campusId)

        // Get teacher count
        const { count: teacherCount } = await supabase
            .from('teachers')
            .select('*', { count: 'exact', head: true })
            .eq('campus_id', campusId)

        // Get staff count
        const { count: staffCount } = await supabase
            .from('staff')
            .select('*', { count: 'exact', head: true })
            .eq('campus_id', campusId)

        // Get parent count (parents don't have campus_id, so count all for the school)
        const { data: campusData } = await supabase
            .from('schools')
            .select('parent_school_id')
            .eq('id', campusId)
            .single()
        
        const schoolId = campusData?.parent_school_id || campusId
        const { count: parentCount } = await supabase
            .from('parents')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', schoolId)

        // Get grade level count
        const { count: gradeLevelCount } = await supabase
            .from('grade_levels')
            .select('*', { count: 'exact', head: true })
            .eq('campus_id', campusId)

        // Get section count
        const { count: sectionCount } = await supabase
            .from('sections')
            .select('*', { count: 'exact', head: true })
            .eq('campus_id', campusId)

        return {
            total_students: studentCount || 0,
            total_teachers: teacherCount || 0,
            total_staff: staffCount || 0,
            total_parents: parentCount || 0,
            total_grade_levels: gradeLevelCount || 0,
            total_sections: sectionCount || 0,
        }
    }
}

export const setupStatusService = new SetupStatusService()
