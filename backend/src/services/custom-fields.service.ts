import { supabase } from '../config/supabase'

// Types
export type CustomFieldType = 'text' | 'long-text' | 'number' | 'date' | 'checkbox' | 'select' | 'multi-select' | 'file'
export type EntityType = 'student' | 'teacher' | 'parent'
export type CampusScope = 'this_campus' | 'selected_campuses' | 'all_campuses'

export interface CustomFieldDefinition {
    id: string
    school_id: string
    entity_type: EntityType
    category_id: string
    category_name: string
    field_key: string
    label: string
    type: CustomFieldType
    options: string[]
    required: boolean
    sort_order: number
    category_order?: number
    campus_scope: CampusScope
    applicable_school_ids: string[]
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface CreateCustomFieldDTO {
    entity_type: EntityType
    category_id: string
    category_name: string
    field_key: string
    label: string
    type: CustomFieldType
    options?: string[]
    required?: boolean
    sort_order?: number
    category_order?: number
    campus_scope?: CampusScope
    applicable_school_ids?: string[]
}

export interface UpdateCustomFieldDTO {
    category_id?: string
    category_name?: string
    field_key?: string
    label?: string
    type?: CustomFieldType
    options?: string[]
    required?: boolean
    sort_order?: number
    category_order?: number
    campus_scope?: CampusScope
    applicable_school_ids?: string[]
    is_active?: boolean
}

export class CustomFieldsService {
    /**
     * Get all custom field definitions for a school and entity type
     * Also includes fields from parent school with all_campuses scope
     * And fields targeting this school via selected_campuses
     */
    async getFieldDefinitions(schoolId: string, entityType: EntityType): Promise<CustomFieldDefinition[]> {
        // First, get the parent school ID if this school has one
        const { data: school } = await supabase
            .from('schools')
            .select('parent_school_id')
            .eq('id', schoolId)
            .single()

        const parentSchoolId = school?.parent_school_id

        // Fetch all active fields for the entity type, then filter in code
        const { data, error } = await supabase
            .from('custom_field_definitions')
            .select('*')
            .eq('entity_type', entityType)
            .eq('is_active', true)
            .order('sort_order', { ascending: true })

        if (error) {
            console.error('Error fetching custom fields:', JSON.stringify(error, null, 2))
            throw new Error(`Failed to fetch custom field definitions: ${error.message || error.code}`)
        }

        console.log(`Custom fields query result: ${data?.length || 0} fields found for ${entityType}`)

        // Filter to include:
        // 1. Fields from this school
        // 2. Fields from parent with all_campuses scope
        // 3. Fields that include this school in applicable_school_ids
        const filtered = (data || []).filter(field => {
            // This school's own fields
            if (field.school_id === schoolId) return true

            // Parent's fields with all_campuses scope
            if (parentSchoolId && field.school_id === parentSchoolId && field.campus_scope === 'all_campuses') {
                return true
            }

            // Fields from any school that include this school in selected_campuses
            if (field.campus_scope === 'selected_campuses' && field.applicable_school_ids?.includes(schoolId)) {
                return true
            }

            return false
        })

        return filtered as CustomFieldDefinition[]
    }

    /**
     * Get fields grouped by category
     */
    async getFieldsByCategory(schoolId: string, entityType: EntityType): Promise<Record<string, CustomFieldDefinition[]>> {
        const fields = await this.getFieldDefinitions(schoolId, entityType)

        const grouped: Record<string, CustomFieldDefinition[]> = {}
        for (const field of fields) {
            if (!grouped[field.category_id]) {
                grouped[field.category_id] = []
            }
            grouped[field.category_id].push(field)
        }

        // Sort each category's fields by sort_order
        for (const categoryId in grouped) {
            grouped[categoryId].sort((a, b) => a.sort_order - b.sort_order)
        }

        return grouped
    }

    /**
     * Create a new custom field definition
     */
    async createFieldDefinition(schoolId: string, data: CreateCustomFieldDTO): Promise<CustomFieldDefinition> {
        // Generate field_key if not provided
        const fieldKey = data.field_key || `${data.category_id}_${Date.now()}`

        const { data: created, error } = await supabase
            .from('custom_field_definitions')
            .insert({
                school_id: schoolId,
                entity_type: data.entity_type,
                category_id: data.category_id,
                category_name: data.category_name,
                field_key: fieldKey,
                label: data.label,
                type: data.type,
                options: data.options || [],
                required: data.required ?? false,
                sort_order: data.sort_order ?? 0,
                category_order: data.category_order ?? 0,
                campus_scope: data.campus_scope ?? 'this_campus',
                applicable_school_ids: data.applicable_school_ids || []
            })
            .select()
            .single()

        if (error) {
            console.error('Error creating custom field:', error)
            if (error.code === '23505') {
                throw new Error('A field with this key already exists')
            }
            throw new Error('Failed to create custom field definition')
        }

        return created as CustomFieldDefinition
    }

    /**
     * Update a custom field definition
     */
    async updateFieldDefinition(fieldId: string, schoolId: string, data: UpdateCustomFieldDTO): Promise<CustomFieldDefinition> {
        // Verify ownership
        const { data: existing, error: fetchError } = await supabase
            .from('custom_field_definitions')
            .select('school_id')
            .eq('id', fieldId)
            .single()

        if (fetchError || !existing) {
            throw new Error('Field definition not found')
        }

        if (existing.school_id !== schoolId) {
            throw new Error('You can only update fields defined by your school')
        }

        const { data: updated, error } = await supabase
            .from('custom_field_definitions')
            .update(data)
            .eq('id', fieldId)
            .select()
            .single()

        if (error) {
            console.error('Error updating custom field:', error)
            throw new Error('Failed to update custom field definition')
        }

        return updated as CustomFieldDefinition
    }

    /**
     * Soft delete a custom field definition
     */
    async deleteFieldDefinition(fieldId: string, schoolId: string): Promise<void> {
        // Verify ownership
        const { data: existing, error: fetchError } = await supabase
            .from('custom_field_definitions')
            .select('school_id')
            .eq('id', fieldId)
            .single()

        if (fetchError || !existing) {
            throw new Error('Field definition not found')
        }

        if (existing.school_id !== schoolId) {
            throw new Error('You can only delete fields defined by your school')
        }

        const { error } = await supabase
            .from('custom_field_definitions')
            .update({ is_active: false })
            .eq('id', fieldId)

        if (error) {
            console.error('Error deleting custom field:', error)
            throw new Error('Failed to delete custom field definition')
        }
    }

    /**
     * Reorder fields within a category
     */
    async reorderFields(schoolId: string, categoryId: string, orderedIds: string[]): Promise<void> {
        // Update sort_order for each field
        const updates = orderedIds.map((id, index) =>
            supabase
                .from('custom_field_definitions')
                .update({ sort_order: index })
                .eq('id', id)
                .eq('school_id', schoolId)
                .eq('category_id', categoryId)
        )

        const results = await Promise.all(updates)

        const hasError = results.some(r => r.error)
        if (hasError) {
            console.error('Error reordering fields:', results.filter(r => r.error))
            throw new Error('Failed to reorder some fields')
        }
    }

    /**
     * Get all branch schools for a parent school (for campus selection)
     */
    async getBranchSchools(parentSchoolId: string): Promise<{ id: string; name: string }[]> {
        const { data, error } = await supabase
            .from('schools')
            .select('id, name')
            .eq('parent_school_id', parentSchoolId)
            .eq('status', 'active')
            .order('name')

        if (error) {
            console.error('Error fetching branch schools:', error)
            throw new Error('Failed to fetch branch schools')
        }

        return data || []
    }
}

export const customFieldsService = new CustomFieldsService()
