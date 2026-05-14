import { supabase } from '../config/supabase'

// Types
export interface SchoolService {
    id: string
    school_id: string
    name: string
    code: string
    description?: string
    service_type: 'recurring' | 'one_time'
    charge_frequency: 'monthly' | 'quarterly' | 'yearly' | 'one_time'
    default_charge: number
    is_mandatory: boolean
    is_active: boolean
    display_order: number
    created_at: string
    grade_charges?: ServiceGradeCharge[]
}

export interface ServiceGradeCharge {
    id: string
    service_id: string
    grade_level_id: string
    school_id: string
    charge_amount: number
    is_active: boolean
    grade_level?: { id: string; name: string }
}

export interface StudentService {
    id: string
    student_id: string
    service_id: string
    school_id: string
    start_date: string
    end_date?: string
    custom_charge?: number
    is_active: boolean
    service?: SchoolService
}

export interface CreateServiceDTO {
    school_id: string
    name: string
    code: string
    description?: string
    service_type?: 'recurring' | 'one_time'
    charge_frequency?: 'monthly' | 'quarterly' | 'yearly' | 'one_time'
    default_charge: number
    is_mandatory?: boolean
    display_order?: number
}

export interface CreateGradeChargeDTO {
    service_id: string
    grade_level_id: string
    school_id: string
    charge_amount: number
}

class SchoolServicesService {
    // =========================================
    // School Services CRUD
    // =========================================

    async getServices(schoolId: string, activeOnly = true): Promise<SchoolService[]> {
        let query = supabase
            .from('school_services')
            .select(`
        *,
        grade_charges:service_grade_charges(
          id, service_id, grade_level_id, charge_amount, is_active,
          grade_level:grade_levels(id, name)
        )
      `)
            .eq('school_id', schoolId)
            .order('display_order', { ascending: true })

        if (activeOnly) {
            query = query.eq('is_active', true)
        }

        const { data, error } = await query

        if (error) {
            throw new Error(`Failed to fetch services: ${error.message}`)
        }

        return data || []
    }

    async getServiceById(serviceId: string, schoolId: string): Promise<SchoolService | null> {
        const { data, error } = await supabase
            .from('school_services')
            .select(`
        *,
        grade_charges:service_grade_charges(
          id, service_id, grade_level_id, charge_amount, is_active,
          grade_level:grade_levels(id, name)
        )
      `)
            .eq('id', serviceId)
            .eq('school_id', schoolId)
            .single()

        if (error) {
            if (error.code === 'PGRST116') return null
            throw new Error(`Failed to fetch service: ${error.message}`)
        }

        return data
    }

    async createService(serviceData: CreateServiceDTO): Promise<SchoolService> {
        const { data, error } = await supabase
            .from('school_services')
            .insert({
                school_id: serviceData.school_id,
                name: serviceData.name,
                code: serviceData.code.toUpperCase(),
                description: serviceData.description,
                service_type: serviceData.service_type || 'recurring',
                charge_frequency: serviceData.charge_frequency || 'monthly',
                default_charge: serviceData.default_charge,
                is_mandatory: serviceData.is_mandatory || false,
                display_order: serviceData.display_order || 0
            })
            .select()
            .single()

        if (error) {
            throw new Error(`Failed to create service: ${error.message}`)
        }

        return data
    }

    async updateService(serviceId: string, schoolId: string, updates: Partial<SchoolService>): Promise<SchoolService> {
        const { data, error } = await supabase
            .from('school_services')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', serviceId)
            .eq('school_id', schoolId)
            .select()
            .single()

        if (error) {
            throw new Error(`Failed to update service: ${error.message}`)
        }

        return data
    }

    async deleteService(serviceId: string, schoolId: string): Promise<void> {
        const { error } = await supabase
            .from('school_services')
            .delete()
            .eq('id', serviceId)
            .eq('school_id', schoolId)

        if (error) {
            throw new Error(`Failed to delete service: ${error.message}`)
        }
    }

    // =========================================
    // Grade-Level Charges
    // =========================================

    async setGradeCharges(serviceId: string, schoolId: string, charges: CreateGradeChargeDTO[]): Promise<ServiceGradeCharge[]> {
        // Delete existing charges for this service
        await supabase
            .from('service_grade_charges')
            .delete()
            .eq('service_id', serviceId)

        if (charges.length === 0) {
            return []
        }

        // Insert new charges
        const { data, error } = await supabase
            .from('service_grade_charges')
            .insert(charges.map(c => ({
                service_id: serviceId,
                grade_level_id: c.grade_level_id,
                school_id: schoolId,
                charge_amount: c.charge_amount,
                is_active: true
            })))
            .select()

        if (error) {
            throw new Error(`Failed to set grade charges: ${error.message}`)
        }

        return data || []
    }

    // =========================================
    // Student Service Subscriptions
    // =========================================

    async getStudentServices(studentId: string, schoolId: string): Promise<StudentService[]> {
        const { data, error } = await supabase
            .from('student_services')
            .select(`
        *,
        service:school_services(*)
      `)
            .eq('student_id', studentId)
            .eq('school_id', schoolId)
            .eq('is_active', true)

        if (error) {
            throw new Error(`Failed to fetch student services: ${error.message}`)
        }

        return data || []
    }

    async subscribeStudentToServices(
        studentId: string,
        schoolId: string,
        serviceIds: string[]
    ): Promise<StudentService[]> {
        if (serviceIds.length === 0) {
            return []
        }

        // Upsert subscriptions
        const { data, error } = await supabase
            .from('student_services')
            .upsert(
                serviceIds.map(serviceId => ({
                    student_id: studentId,
                    service_id: serviceId,
                    school_id: schoolId,
                    start_date: new Date().toISOString().split('T')[0],
                    is_active: true
                })),
                { onConflict: 'student_id,service_id' }
            )
            .select()

        if (error) {
            throw new Error(`Failed to subscribe student to services: ${error.message}`)
        }

        return data || []
    }

    async unsubscribeStudentFromService(studentId: string, serviceId: string, schoolId: string): Promise<void> {
        const { error } = await supabase
            .from('student_services')
            .update({
                is_active: false,
                end_date: new Date().toISOString().split('T')[0],
                updated_at: new Date().toISOString()
            })
            .eq('student_id', studentId)
            .eq('service_id', serviceId)
            .eq('school_id', schoolId)

        if (error) {
            throw new Error(`Failed to unsubscribe student from service: ${error.message}`)
        }
    }

    // =========================================
    // Charge Calculation
    // =========================================

    async calculateStudentServicesTotal(studentId: string, schoolId: string): Promise<number> {
        // Get student's grade level
        const { data: student } = await supabase
            .from('students')
            .select('grade_level_id')
            .eq('id', studentId)
            .single()

        const gradeLevelId = student?.grade_level_id

        // Get all active subscriptions with service details
        const { data: subscriptions, error } = await supabase
            .from('student_services')
            .select(`
        id, custom_charge, service_id,
        service:school_services(id, default_charge)
      `)
            .eq('student_id', studentId)
            .eq('school_id', schoolId)
            .eq('is_active', true)

        if (error) {
            throw new Error(`Failed to calculate services total: ${error.message}`)
        }

        let total = 0

        for (const sub of subscriptions || []) {
            // Priority: custom_charge > grade_charge > default_charge
            if (sub.custom_charge !== null) {
                total += sub.custom_charge
                continue
            }

            // Check for grade-specific charge
            if (gradeLevelId) {
                const { data: gradeCharge } = await supabase
                    .from('service_grade_charges')
                    .select('charge_amount')
                    .eq('service_id', sub.service_id)
                    .eq('grade_level_id', gradeLevelId)
                    .eq('is_active', true)
                    .single()

                if (gradeCharge) {
                    total += gradeCharge.charge_amount
                    continue
                }
            }

            // Fall back to default charge
            total += (sub.service as any)?.default_charge || 0
        }

        return total
    }
}

export const schoolServicesService = new SchoolServicesService()
