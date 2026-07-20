import { supabase } from '../config/supabase'
import { attachLogoAppearance, getLogoAppearance } from './logo-appearance.service'

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
        logo_url?: string | null
        city?: string
        state?: string
        zip_code?: string
        phone?: string
        principal_name?: string
        short_name?: string
        school_number?: string
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
                logo_url: campusData.logo_url || null,
                city: campusData.city || null,
                state: campusData.state || null,
                zip_code: campusData.zip_code || null,
                phone: campusData.phone || null,
                principal_name: campusData.principal_name || null,
                short_name: campusData.short_name || null,
                school_number: campusData.school_number || null,
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
            // only active campuses (deleted ones are marked suspended)
            .neq('status', 'suspended')
            .order('name')

        if (error) {
            console.error('Error fetching campuses:', error)
            throw new Error('Failed to fetch campuses')
        }

        return attachLogoAppearance(data || [])
    }

    /**
     * Update a campus
     */
    async updateCampus(campusId: string, updates: {
        name?: string
        address?: string
        contact_email?: string
        custom_fields?: Record<string, any>
        [key: string]: any
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

        const appearance = await getLogoAppearance(campusId)
        return { ...data, ...appearance }
    }

    /**
     * Get campus statistics
     */
    async getCampusStats(campusId: string): Promise<{
        total_students: number
        boys_count: number
        girls_count: number
        total_teachers: number
        male_teachers: number
        female_teachers: number
        total_staff: number
        male_staff: number
        female_staff: number
        total_parents: number
        total_grade_levels: number
        total_sections: number
        present_today: number
        attendance_percentage_today: number
    }> {
        const today = new Date().toISOString().split('T')[0]

        // Students with gender breakdown directly from students custom_fields
        const { data: studentRows } = await supabase
            .from('students')
            .select('custom_fields')
            .eq('school_id', campusId)

        const totalStudents = studentRows?.length || 0
        const boysCount = studentRows?.filter((s: any) => s.custom_fields?.personal?.gender?.toLowerCase() === 'male').length || 0
        const girlsCount = studentRows?.filter((s: any) => s.custom_fields?.personal?.gender?.toLowerCase() === 'female').length || 0

        // Teachers with gender breakdown via custom_fields
        const { data: teacherRows } = await supabase
            .from('staff')
            .select('custom_fields')
            .eq('school_id', campusId)
            .eq('role', 'teacher')

        const teacherCount = teacherRows?.length || 0
        const maleTeachers = teacherRows?.filter((s: any) => s.custom_fields?.personal?.gender?.toLowerCase() === 'male').length || 0
        const femaleTeachers = teacherRows?.filter((s: any) => s.custom_fields?.personal?.gender?.toLowerCase() === 'female').length || 0

        // Staff with gender breakdown via custom_fields
        const { data: staffRows } = await supabase
            .from('staff')
            .select('custom_fields')
            .eq('school_id', campusId)
            .in('role', ['staff', 'librarian', 'admin', 'counselor'])

        const staffCount = staffRows?.length || 0
        const maleStaff = staffRows?.filter((s: any) => s.custom_fields?.personal?.gender?.toLowerCase() === 'male').length || 0
        const femaleStaff = staffRows?.filter((s: any) => s.custom_fields?.personal?.gender?.toLowerCase() === 'female').length || 0

        // Parent count (parents belong to parent school)
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

        // Grade level count
        const { count: gradeLevelCount } = await supabase
            .from('grade_levels')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', campusId)

        // Section count
        const { count: sectionCount } = await supabase
            .from('sections')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', campusId)

        // Today's attendance
        const { data: todayAttendance } = await supabase
            .from('attendance_records')
            .select('status')
            .eq('school_id', campusId)
            .eq('attendance_date', today)

        const presentToday = todayAttendance?.filter(r => r.status === 'present').length || 0
        const totalToday = todayAttendance?.length || 0
        const attendancePct = totalToday > 0 ? parseFloat(((presentToday / totalToday) * 100).toFixed(1)) : 0

        return {
            total_students: totalStudents,
            boys_count: boysCount,
            girls_count: girlsCount,
            total_teachers: teacherCount,
            male_teachers: maleTeachers,
            female_teachers: femaleTeachers,
            total_staff: staffCount,
            male_staff: maleStaff,
            female_staff: femaleStaff,
            total_parents: parentCount || 0,
            total_grade_levels: gradeLevelCount || 0,
            total_sections: sectionCount || 0,
            present_today: presentToday,
            attendance_percentage_today: attendancePct,
        }
    }
}

export const setupStatusService = new SetupStatusService()
