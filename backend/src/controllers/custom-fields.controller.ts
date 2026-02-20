import { Response, NextFunction } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { customFieldsService, EntityType } from '../services/custom-fields.service'

export class CustomFieldsController {
    /**
     * GET /custom-fields/:entityType
     * Get all custom field definitions for the current school/campus
     * Query params:
     * - campus_id: Optional campus ID to get campus-specific fields
     */
    async getFieldDefinitions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const adminSchoolId = req.profile?.school_id
            const entityType = req.params.entityType as EntityType
            // Use campus_id if provided, otherwise fall back to admin's school_id
            const campusId = req.query.campus_id as string | undefined
            const effectiveSchoolId = campusId || adminSchoolId

            if (!effectiveSchoolId) {
                res.status(400).json({
                    success: false,
                    error: 'School context required'
                })
                return
            }

            if (!['student', 'teacher', 'parent', 'staff'].includes(entityType)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid entity type. Must be "student", "teacher", "parent", or "staff"'
                })
                return
            }

            const fields = await customFieldsService.getFieldDefinitions(effectiveSchoolId, entityType)

            res.json({
                success: true,
                data: fields
            })
        } catch (error) {
            next(error)
        }
    }

    /**
     * GET /custom-fields/:entityType/by-category
     * Get fields grouped by category
     */
    async getFieldsByCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const schoolId = req.profile?.school_id
            const entityType = req.params.entityType as EntityType

            if (!schoolId) {
                res.status(400).json({
                    success: false,
                    error: 'School context required'
                })
                return
            }

            const grouped = await customFieldsService.getFieldsByCategory(schoolId, entityType)

            res.json({
                success: true,
                data: grouped
            })
        } catch (error) {
            next(error)
        }
    }

    /**
     * POST /custom-fields
     * Create a new custom field definition
     * Query params:
     * - campus_id: Optional campus ID to create field for specific campus
     */
    async createFieldDefinition(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const adminSchoolId = req.profile?.school_id
            // Use campus_id if provided, otherwise fall back to admin's school_id
            const campusId = req.query.campus_id as string | undefined
            const effectiveSchoolId = campusId || adminSchoolId

            if (!effectiveSchoolId) {
                res.status(400).json({
                    success: false,
                    error: 'School context required'
                })
                return
            }

            const { entity_type, category_id, category_name, field_key, label, type, options, required, sort_order, category_order, campus_scope, applicable_school_ids } = req.body

            if (!entity_type || !category_id || !category_name || !label || !type) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required fields: entity_type, category_id, category_name, label, type'
                })
                return
            }

            const field = await customFieldsService.createFieldDefinition(effectiveSchoolId, {
                entity_type,
                category_id,
                category_name,
                field_key,
                label,
                type,
                options,
                required,
                sort_order,
                category_order,
                campus_scope,
                applicable_school_ids
            })

            res.status(201).json({
                success: true,
                data: field,
                message: 'Custom field created successfully'
            })
        } catch (error: any) {
            if (error.message.includes('already exists')) {
                res.status(409).json({
                    success: false,
                    error: error.message
                })
                return
            }
            next(error)
        }
    }

    /**
     * PATCH /custom-fields/:id
     * Update a custom field definition
     */
    async updateFieldDefinition(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const schoolId = req.profile?.school_id
            const fieldId = req.params.id

            if (!schoolId) {
                res.status(400).json({
                    success: false,
                    error: 'School context required'
                })
                return
            }

            const updates = req.body

            const field = await customFieldsService.updateFieldDefinition(fieldId, schoolId, updates)

            res.json({
                success: true,
                data: field,
                message: 'Custom field updated successfully'
            })
        } catch (error: any) {
            if (error.message.includes('not found')) {
                res.status(404).json({
                    success: false,
                    error: error.message
                })
                return
            }
            if (error.message.includes('only update')) {
                res.status(403).json({
                    success: false,
                    error: error.message
                })
                return
            }
            next(error)
        }
    }

    /**
     * DELETE /custom-fields/:id
     * Soft delete a custom field definition
     */
    async deleteFieldDefinition(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const schoolId = req.profile?.school_id
            const fieldId = req.params.id

            if (!schoolId) {
                res.status(400).json({
                    success: false,
                    error: 'School context required'
                })
                return
            }

            await customFieldsService.deleteFieldDefinition(fieldId, schoolId)

            res.json({
                success: true,
                message: 'Custom field deleted successfully'
            })
        } catch (error: any) {
            if (error.message.includes('not found')) {
                res.status(404).json({
                    success: false,
                    error: error.message
                })
                return
            }
            if (error.message.includes('only delete')) {
                res.status(403).json({
                    success: false,
                    error: error.message
                })
                return
            }
            next(error)
        }
    }

    /**
     * POST /custom-fields/reorder
     * Reorder fields within a category
     */
    async reorderFields(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const schoolId = req.profile?.school_id

            if (!schoolId) {
                res.status(400).json({
                    success: false,
                    error: 'School context required'
                })
                return
            }

            const { category_id, ordered_ids } = req.body

            if (!category_id || !Array.isArray(ordered_ids)) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required fields: category_id, ordered_ids (array)'
                })
                return
            }

            await customFieldsService.reorderFields(schoolId, category_id, ordered_ids)

            res.json({
                success: true,
                message: 'Fields reordered successfully'
            })
        } catch (error) {
            next(error)
        }
    }

    /**
     * GET /custom-fields/branch-schools
     * Get list of branch schools for campus selection
     */
    async getBranchSchools(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
        try {
            const schoolId = req.profile?.school_id

            if (!schoolId) {
                res.status(400).json({
                    success: false,
                    error: 'School context required'
                })
                return
            }

            const branches = await customFieldsService.getBranchSchools(schoolId)

            res.json({
                success: true,
                data: branches
            })
        } catch (error) {
            next(error)
        }
    }
}

export const customFieldsController = new CustomFieldsController()
