import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { setupStatusService } from '../services/setup-status.service'

class SetupStatusController {
    /**
     * Get setup status for the current school
     */
    async getSetupStatus(req: AuthRequest, res: Response) {
        try {
            const schoolId = req.profile?.school_id

            if (!schoolId) {
                return res.status(400).json({ error: 'School context required' })
            }

            const status = await setupStatusService.getSetupStatus(schoolId)
            return res.json(status)
        } catch (error) {
            console.error('Error getting setup status:', error)
            res.status(500).json({ error: 'Failed to get setup status' })
        }
    }

    /**
     * Get all campuses for the current school
     */
    async getCampuses(req: AuthRequest, res: Response) {
        try {
            const schoolId = req.profile?.school_id

            if (!schoolId) {
                return res.status(400).json({ error: 'School context required' })
            }

            const campuses = await setupStatusService.getCampuses(schoolId)
            return res.json(campuses)
        } catch (error) {
            console.error('Error getting campuses:', error)
            res.status(500).json({ error: 'Failed to get campuses' })
        }
    }

    /**
     * Create a new campus
     */
    async createCampus(req: AuthRequest, res: Response) {
        try {
            const schoolId = req.profile?.school_id

            if (!schoolId) {
                return res.status(400).json({ error: 'School context required' })
            }

            const { name, address, contact_email } = req.body

            if (!name) {
                return res.status(400).json({ error: 'Campus name is required' })
            }

            const campus = await setupStatusService.createCampus(schoolId, {
                name,
                address,
                contact_email
            })

            return res.status(201).json(campus)
        } catch (error) {
            console.error('Error creating campus:', error)
            res.status(500).json({ error: 'Failed to create campus' })
        }
    }

    /**
     * Update a campus
     */
    async updateCampus(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params
            const updates = req.body

            const campus = await setupStatusService.updateCampus(id, updates)
            res.json(campus)
        } catch (error) {
            console.error('Error updating campus:', error)
            res.status(500).json({ error: 'Failed to update campus' })
        }
    }

    /**
     * Delete a campus
     */
    async deleteCampus(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params

            await setupStatusService.deleteCampus(id)
            res.json({ message: 'Campus deleted successfully' })
        } catch (error) {
            console.error('Error deleting campus:', error)
            res.status(500).json({ error: 'Failed to delete campus' })
        }
    }

    /**
     * Get a specific campus by ID
     */
    async getCampusById(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params

            const campus = await setupStatusService.getCampusById(id)
            
            if (!campus) {
                return res.status(404).json({ success: false, error: 'Campus not found' })
            }

            res.json({ success: true, data: campus })
        } catch (error) {
            console.error('Error getting campus:', error)
            res.status(500).json({ success: false, error: 'Failed to get campus' })
        }
    }

    /**
     * Get campus statistics
     */
    async getCampusStats(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params

            const stats = await setupStatusService.getCampusStats(id)
            res.json({ success: true, data: stats })
        } catch (error) {
            console.error('Error getting campus stats:', error)
            res.status(500).json({ success: false, error: 'Failed to get campus stats' })
        }
    }
}

export const setupStatusController = new SetupStatusController()
