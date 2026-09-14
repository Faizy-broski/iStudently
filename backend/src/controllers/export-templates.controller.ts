import { Response, NextFunction } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { exportTemplatesService } from '../services/export-templates.service'

export class ExportTemplatesController {
    /**
     * GET /export-templates?report_key=&campus_id=
     */
    async getTemplates(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const schoolId = req.profile?.school_id
            const reportKey = req.query.report_key as string | undefined
            const campusId = req.query.campus_id as string | undefined

            if (!schoolId) {
                res.status(400).json({ success: false, error: 'School context required' })
                return
            }
            if (!reportKey) {
                res.status(400).json({ success: false, error: 'report_key is required' })
                return
            }

            const templates = await exportTemplatesService.getTemplates(schoolId, campusId, reportKey)

            res.json({ success: true, data: templates })
        } catch (error) {
            next(error)
        }
    }

    /**
     * POST /export-templates?campus_id=
     */
    async createTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const schoolId = req.profile?.school_id
            const userId = req.profile?.id
            const campusId = req.query.campus_id as string | undefined

            if (!schoolId || !userId) {
                res.status(400).json({ success: false, error: 'School context required' })
                return
            }

            const { report_key, name, columns, is_default } = req.body

            if (!report_key || !name || !Array.isArray(columns)) {
                res.status(400).json({ success: false, error: 'Missing required fields: report_key, name, columns' })
                return
            }

            const template = await exportTemplatesService.createTemplate(schoolId, campusId, userId, {
                report_key,
                name,
                columns,
                is_default,
            })

            res.status(201).json({ success: true, data: template, message: 'Export template created successfully' })
        } catch (error) {
            next(error)
        }
    }

    /**
     * PATCH /export-templates/:id
     */
    async updateTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const schoolId = req.profile?.school_id
            const templateId = req.params.id

            if (!schoolId) {
                res.status(400).json({ success: false, error: 'School context required' })
                return
            }

            const { name, columns, is_default } = req.body
            const template = await exportTemplatesService.updateTemplate(templateId, schoolId, { name, columns, is_default })

            res.json({ success: true, data: template, message: 'Export template updated successfully' })
        } catch (error: any) {
            if (error.message?.includes('not found')) {
                res.status(404).json({ success: false, error: error.message })
                return
            }
            if (error.message?.includes('only manage')) {
                res.status(403).json({ success: false, error: error.message })
                return
            }
            next(error)
        }
    }

    /**
     * DELETE /export-templates/:id
     */
    async deleteTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const schoolId = req.profile?.school_id
            const templateId = req.params.id

            if (!schoolId) {
                res.status(400).json({ success: false, error: 'School context required' })
                return
            }

            await exportTemplatesService.deleteTemplate(templateId, schoolId)

            res.json({ success: true, message: 'Export template deleted successfully' })
        } catch (error: any) {
            if (error.message?.includes('not found')) {
                res.status(404).json({ success: false, error: error.message })
                return
            }
            if (error.message?.includes('only manage')) {
                res.status(403).json({ success: false, error: error.message })
                return
            }
            next(error)
        }
    }

    /**
     * POST /export-templates/:id/set-default
     */
    async setDefault(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const schoolId = req.profile?.school_id
            const templateId = req.params.id

            if (!schoolId) {
                res.status(400).json({ success: false, error: 'School context required' })
                return
            }

            const template = await exportTemplatesService.setDefault(templateId, schoolId)

            res.json({ success: true, data: template, message: 'Default export template updated' })
        } catch (error: any) {
            if (error.message?.includes('not found')) {
                res.status(404).json({ success: false, error: error.message })
                return
            }
            next(error)
        }
    }
}

export const exportTemplatesController = new ExportTemplatesController()
