import { getAuthToken } from './schools';
import { API_URL } from '@/config/api';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getAuthToken();

  if (!token) {
    return {
      success: false,
      error: 'Authentication required. Please sign in.'
    };
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
    return {
      success: false,
      error: errorData.message || `HTTP ${response.status}`,
      message: errorData.message
    };
  }

  return await response.json();
}

export type EntityType = 'student' | 'parent' | 'teacher';

export interface DefaultFieldOrder {
  id: string;
  school_id: string;
  entity_type: EntityType;
  category_id: string;
  field_label: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface FieldOrderInput {
  field_label: string;
  sort_order: number;
}

/**
 * Get field orders for an entity type
 */
export async function getFieldOrders(
  entityType: EntityType,
  categoryId?: string,
  campusId?: string
): Promise<ApiResponse<DefaultFieldOrder[]>> {
  try {
    const params = new URLSearchParams();
    if (categoryId) params.append('category_id', categoryId);
    if (campusId) params.append('campus_id', campusId);

    const queryString = params.toString();
    const endpoint = `/default-field-orders/${entityType}${queryString ? `?${queryString}` : ''}`;
    
    return await apiRequest<DefaultFieldOrder[]>(endpoint);
  } catch (error: any) {
    console.error('Error getting field orders:', error);
    return {
      success: false,
      message: error.message || 'Failed to get field orders'
    };
  }
}

/**
 * Save field orders for a specific category
 */
export async function saveFieldOrders(
  entityType: EntityType,
  categoryId: string,
  fields: FieldOrderInput[],
  campusId?: string
): Promise<ApiResponse> {
  try {
    return await apiRequest(`/default-field-orders/${entityType}/${categoryId}`, {
      method: 'POST',
      body: JSON.stringify({
        fields,
        campus_id: campusId
      })
    });
  } catch (error: any) {
    console.error('Error saving field orders:', error);
    return {
      success: false,
      message: error.message || 'Failed to save field orders'
    };
  }
}

/**
 * Delete field orders for a specific category (reset to defaults)
 */
export async function deleteFieldOrders(
  entityType: EntityType,
  categoryId: string,
  campusId?: string
): Promise<ApiResponse> {
  try {
    const params = new URLSearchParams();
    if (campusId) params.append('campus_id', campusId);

    const queryString = params.toString();
    const endpoint = `/default-field-orders/${entityType}/${categoryId}${queryString ? `?${queryString}` : ''}`;
    
    return await apiRequest(endpoint, {
      method: 'DELETE'
    });
  } catch (error: any) {
    console.error('Error deleting field orders:', error);
    return {
      success: false,
      message: error.message || 'Failed to delete field orders'
    };
  }
}

/**
 * Reset all field orders for an entity type
 */
export async function resetAllFieldOrders(
  entityType: EntityType,
  campusId?: string
): Promise<ApiResponse> {
  try {
    const params = new URLSearchParams();
    if (campusId) params.append('campus_id', campusId);

    const queryString = params.toString();
    const endpoint = `/default-field-orders/${entityType}${queryString ? `?${queryString}` : ''}`;
    
    return await apiRequest(endpoint, {
      method: 'DELETE'
    });
  } catch (error: any) {
    console.error('Error resetting field orders:', error);
    return {
      success: false,
      message: error.message || 'Failed to reset field orders'
    };
  }
}

/**
 * Get effective field order for a category
 * Returns saved order from database, or default order if not customized
 */
export function getEffectiveFieldOrder(
  savedOrders: DefaultFieldOrder[],
  categoryId: string,
  defaultFields: Array<{ label: string; sort_order: number }>
): Array<{ label: string; sort_order: number }> {
  // Filter orders for this category
  const categoryOrders = savedOrders.filter(order => order.category_id === categoryId);
  
  if (categoryOrders.length === 0) {
    // No custom ordering, return default
    return [...defaultFields].sort((a, b) => a.sort_order - b.sort_order);
  }
  
  // Use saved ordering
  return categoryOrders
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(order => ({
      label: order.field_label,
      sort_order: order.sort_order
    }));
}
