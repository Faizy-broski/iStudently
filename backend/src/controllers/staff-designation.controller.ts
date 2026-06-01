import { Request, Response } from 'express'
import * as DesignationService from '../services/staff-designation.service'

/**
 * Get all designations for a school/campus
 */
export const getDesignations = async (req: Request, res: Response) => {
    try {
        const schoolId = (req as any).profile?.school_id
        const { campus_id } = req.query

        if (!schoolId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' })
        }

        const result = await DesignationService.getDesignations(
            schoolId,
            campus_id as string | undefined
        )

        if (!result.success) {
            return res.status(400).json(result)
        }

        return res.json(result)
    } catch (error: any) {
        console.error('Error getting designations:', error)
        return res.status(500).json({ success: false, error: error.message })
    }
}

/**
 * Get all designations grouped by campus
 */
export const getDesignationsGrouped = async (req: Request, res: Response) => {
    try {
        const schoolId = (req as any).profile?.school_id

        if (!schoolId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' })
        }

        const result = await DesignationService.getAllDesignationsGrouped(schoolId)

        if (!result.success) {
            return res.status(400).json(result)
        }

        return res.json(result)
    } catch (error: any) {
        console.error('Error getting grouped designations:', error)
        return res.status(500).json({ success: false, error: error.message })
    }
}

/**
 * Create a new designation
 */
export const createDesignation = async (req: Request, res: Response) => {
    try {
        const schoolId = (req as any).profile?.school_id
        const createdBy = (req as any).profile?.id
        const role = (req as any).profile?.role

        if (!schoolId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' })
        }

        if (role !== 'admin' && role !== 'super_admin') {
            return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' })
        }

        const { name, campus_id, description } = req.body

        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ success: false, error: 'Designation name is required' })
        }

        const result = await DesignationService.createDesignation(
            schoolId,
            { name, campus_id, description },
            createdBy
        )

        if (!result.success) {
            return res.status(400).json(result)
        }

        return res.status(201).json(result)
    } catch (error: any) {
        console.error('Error creating designation:', error)
        return res.status(500).json({ success: false, error: error.message })
    }
}

/**
 * Update a designation
 */
export const updateDesignation = async (req: Request, res: Response) => {
    try {
        const schoolId = (req as any).profile?.school_id
        const role = (req as any).profile?.role
        const { id } = req.params

        if (!schoolId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' })
        }

        if (role !== 'admin' && role !== 'super_admin') {
            return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' })
        }

        const { name, description, is_active } = req.body

        const result = await DesignationService.updateDesignation(id, { name, description, is_active })

        if (!result.success) {
            return res.status(400).json(result)
        }

        return res.json(result)
    } catch (error: any) {
        console.error('Error updating designation:', error)
        return res.status(500).json({ success: false, error: error.message })
    }
}

/**
 * Delete a designation
 */
export const deleteDesignation = async (req: Request, res: Response) => {
    try {
        const schoolId = (req as any).profile?.school_id
        const role = (req as any).profile?.role
        const { id } = req.params

        if (!schoolId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' })
        }

        if (role !== 'admin' && role !== 'super_admin') {
            return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' })
        }

        const result = await DesignationService.deleteDesignation(id)

        if (!result.success) {
            return res.status(400).json(result)
        }

        return res.json({ success: true, message: 'Designation deleted successfully' })
    } catch (error: any) {
        console.error('Error deleting designation:', error)
        return res.status(500).json({ success: false, error: error.message })
    }
}

/**
 * Seed default designations for the school
 */
export const seedDefaultDesignations = async (req: Request, res: Response) => {
    try {
        const schoolId = (req as any).profile?.school_id
        const createdBy = (req as any).profile?.id
        const role = (req as any).profile?.role

        if (!schoolId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' })
        }

        if (role !== 'admin' && role !== 'super_admin') {
            return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' })
        }

        const result = await DesignationService.seedDefaultDesignations(schoolId, createdBy)

        if (!result.success) {
            return res.status(400).json(result)
        }

        return res.status(201).json(result)
    } catch (error: any) {
        console.error('Error seeding designations:', error)
        return res.status(500).json({ success: false, error: error.message })
    }
}
