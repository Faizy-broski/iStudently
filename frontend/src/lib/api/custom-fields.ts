/**
 * Custom Fields API Client
 * Handles CRUD operations for custom field definitions
 */

import { API_URL } from '@/config/api'
import { getAuthToken } from './schools'

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
    field_key?: string
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
    category_order?: number
    field_key?: string
    label?: string
    type?: CustomFieldType
    options?: string[]
    required?: boolean
    sort_order?: number
    campus_scope?: CampusScope
    applicable_school_ids?: string[]
}

interface ApiResponse<T = unknown> {
    success: boolean
    data?: T
    error?: string
    message?: string
}

export interface BranchSchool {
    id: string
    name: string
}

// NOTE: Using centralized getAuthToken from schools.ts which includes
// session validation wait logic to prevent race conditions on tab focus

// API request helper
async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<ApiResponse<T>> {
    const token = await getAuthToken()

    if (!token) {
        return { success: false, error: 'Authentication required' }
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                ...options.headers
            }
        })

        const data = await response.json()

        if (!response.ok) {
            return {
                success: false,
                error: data.error || `Request failed with status ${response.status}`
            }
        }

        return data
    } catch (error) {
        console.error('Custom Fields API Error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        }
    }
}

// API Methods

/**
 * Get all custom field definitions for an entity type
 * @param entityType - The entity type (student, teacher, parent)
 * @param campusId - Optional campus ID to get campus-specific fields
 */
export async function getFieldDefinitions(entityType: EntityType, campusId?: string): Promise<ApiResponse<CustomFieldDefinition[]>> {
    const url = campusId 
        ? `/custom-fields/${entityType}?campus_id=${campusId}`
        : `/custom-fields/${entityType}`
    return apiRequest<CustomFieldDefinition[]>(url)
}

/**
 * Get field definitions grouped by category
 */
export async function getFieldsByCategory(entityType: EntityType): Promise<ApiResponse<Record<string, CustomFieldDefinition[]>>> {
    return apiRequest<Record<string, CustomFieldDefinition[]>>(`/custom-fields/${entityType}/by-category`)
}

/**
 * Create a new custom field definition
 * @param data - The field definition data
 * @param campusId - Optional campus ID to create field for specific campus
 */
export async function createFieldDefinition(data: CreateCustomFieldDTO, campusId?: string): Promise<ApiResponse<CustomFieldDefinition>> {
    const url = campusId 
        ? `/custom-fields?campus_id=${campusId}`
        : '/custom-fields'
    return apiRequest<CustomFieldDefinition>(url, {
        method: 'POST',
        body: JSON.stringify(data)
    })
}

/**
 * Update a custom field definition
 */
export async function updateFieldDefinition(fieldId: string, data: UpdateCustomFieldDTO): Promise<ApiResponse<CustomFieldDefinition>> {
    return apiRequest<CustomFieldDefinition>(`/custom-fields/${fieldId}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    })
}

/**
 * Delete a custom field definition (soft delete)
 */
export async function deleteFieldDefinition(fieldId: string): Promise<ApiResponse<void>> {
    return apiRequest<void>(`/custom-fields/${fieldId}`, {
        method: 'DELETE'
    })
}

/**
 * Reorder fields within a category
 */
export async function reorderFields(categoryId: string, orderedIds: string[]): Promise<ApiResponse<void>> {
    return apiRequest<void>('/custom-fields/reorder', {
        method: 'POST',
        body: JSON.stringify({ category_id: categoryId, ordered_ids: orderedIds })
    })
}

/**
 * Get branch schools for campus selection
 */
export async function getBranchSchools(): Promise<ApiResponse<BranchSchool[]>> {
    return apiRequest<BranchSchool[]>('/custom-fields/branch-schools')
}

// Exported API object for convenience
export const customFieldsApi = {
    getFieldDefinitions,
    getFieldsByCategory,
    createFieldDefinition,
    updateFieldDefinition,
    deleteFieldDefinition,
    reorderFields,
    getBranchSchools
}
