import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { schoolServicesService } from '../services/school-services.service'
import { getEffectiveSchoolId } from '../utils/campus-validation'

export class SchoolServicesController {
    /**
     * GET /api/school-services
     * Get all school services (filtered by campus if campus_id provided)
     */
    async getServices(req: AuthRequest, res: Response): Promise<void> {
        try {
            const adminSchoolId = req.profile?.school_id
            const campusId = req.query.campus_id as string
            const activeOnly = req.query.active !== 'false'

            if (!adminSchoolId) {
                res.status(403).json({ success: false, error: 'No school associated' })
                return
            }

            // Use campus ID if provided, otherwise use admin's school
            const effectiveSchoolId = (campusId && campusId.trim() !== '') ? campusId : adminSchoolId

            const services = await schoolServicesService.getServices(effectiveSchoolId, activeOnly)

            res.json({ success: true, data: services })
        } catch (error: any) {
            console.error('Get services error:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * GET /api/services/:id
     * Get a single service by ID
     */
    async getServiceById(req: AuthRequest, res: Response): Promise<void> {
        try {
            const schoolId = req.profile?.school_id
            const serviceId = req.params.id

            if (!schoolId) {
                res.status(403).json({ success: false, error: 'No school associated' })
                return
            }

            const service = await schoolServicesService.getServiceById(serviceId, schoolId)

            if (!service) {
                res.status(404).json({ success: false, error: 'Service not found' })
                return
            }

            res.json({ success: true, data: service })
        } catch (error: any) {
            console.error('Get service error:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * POST /api/school-services
     * Create a new service (uses campus_id if provided in body)
     */
    async createService(req: AuthRequest, res: Response): Promise<void> {
        try {
            const adminSchoolId = req.profile?.school_id

            if (!adminSchoolId) {
                res.status(403).json({ success: false, error: 'No school associated' })
                return
            }

            // Get effective school ID (campus if provided, otherwise admin's school)
            const effectiveSchoolId = await getEffectiveSchoolId(
                adminSchoolId,
                req.body.campus_id || req.body.school_id
            )

            const service = await schoolServicesService.createService({
                ...req.body,
                school_id: effectiveSchoolId
            })

            res.status(201).json({ success: true, data: service, message: 'Service created' })
        } catch (error: any) {
            console.error('Create service error:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * PUT /api/services/:id
     * Update a service
     */
    async updateService(req: AuthRequest, res: Response): Promise<void> {
        try {
            const schoolId = req.profile?.school_id
            const serviceId = req.params.id

            if (!schoolId) {
                res.status(403).json({ success: false, error: 'No school associated' })
                return
            }

            const service = await schoolServicesService.updateService(serviceId, schoolId, req.body)

            res.json({ success: true, data: service, message: 'Service updated' })
        } catch (error: any) {
            console.error('Update service error:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * DELETE /api/services/:id
     * Delete a service
     */
    async deleteService(req: AuthRequest, res: Response): Promise<void> {
        try {
            const schoolId = req.profile?.school_id
            const serviceId = req.params.id

            if (!schoolId) {
                res.status(403).json({ success: false, error: 'No school associated' })
                return
            }

            await schoolServicesService.deleteService(serviceId, schoolId)

            res.json({ success: true, message: 'Service deleted' })
        } catch (error: any) {
            console.error('Delete service error:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * PUT /api/services/:id/grade-charges
     * Set grade-level charges for a service
     */
    async setGradeCharges(req: AuthRequest, res: Response): Promise<void> {
        try {
            const schoolId = req.profile?.school_id
            const serviceId = req.params.id
            const { charges } = req.body

            if (!schoolId) {
                res.status(403).json({ success: false, error: 'No school associated' })
                return
            }

            const result = await schoolServicesService.setGradeCharges(serviceId, schoolId, charges)

            res.json({ success: true, data: result, message: 'Grade charges updated' })
        } catch (error: any) {
            console.error('Set grade charges error:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * GET /api/services/student/:studentId
     * Get services subscribed by a student
     */
    async getStudentServices(req: AuthRequest, res: Response): Promise<void> {
        try {
            const schoolId = req.profile?.school_id
            const studentId = req.params.studentId

            if (!schoolId) {
                res.status(403).json({ success: false, error: 'No school associated' })
                return
            }

            const services = await schoolServicesService.getStudentServices(studentId, schoolId)

            res.json({ success: true, data: services })
        } catch (error: any) {
            console.error('Get student services error:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * POST /api/services/student/:studentId/subscribe
     * Subscribe a student to services
     */
    async subscribeStudent(req: AuthRequest, res: Response): Promise<void> {
        try {
            const schoolId = req.profile?.school_id
            const studentId = req.params.studentId
            const { serviceIds } = req.body

            if (!schoolId) {
                res.status(403).json({ success: false, error: 'No school associated' })
                return
            }

            const subscriptions = await schoolServicesService.subscribeStudentToServices(
                studentId,
                schoolId,
                serviceIds
            )

            res.json({ success: true, data: subscriptions, message: 'Student subscribed to services' })
        } catch (error: any) {
            console.error('Subscribe student error:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * DELETE /api/services/student/:studentId/:serviceId
     * Unsubscribe a student from a service
     */
    async unsubscribeStudent(req: AuthRequest, res: Response): Promise<void> {
        try {
            const schoolId = req.profile?.school_id
            const { studentId, serviceId } = req.params

            if (!schoolId) {
                res.status(403).json({ success: false, error: 'No school associated' })
                return
            }

            await schoolServicesService.unsubscribeStudentFromService(studentId, serviceId, schoolId)

            res.json({ success: true, message: 'Student unsubscribed from service' })
        } catch (error: any) {
            console.error('Unsubscribe student error:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }
}
