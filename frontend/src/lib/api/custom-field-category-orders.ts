import { getAuthToken } from './schools';
import { API_URL } from '@/config/api';
import { getImpersonationHeaders } from './abortable-fetch';
import type { EntityType } from './default-field-orders';

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
      ...getImpersonationHeaders(),
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

export interface CustomFieldCategoryOrder {
  category_id: string;
  category_order: number;
}

/**
 * Get category orders for an entity type
 */
export async function getCategoryOrders(
  entityType: EntityType,
  campusId?: string
): Promise<ApiResponse<CustomFieldCategoryOrder[]>> {
  try {
    const params = new URLSearchParams();
    if (campusId) params.append('campus_id', campusId);

    const queryString = params.toString();
    const endpoint = `/custom-field-category-orders/${entityType}${queryString ? `?${queryString}` : ''}`;

    return await apiRequest<CustomFieldCategoryOrder[]>(endpoint);
  } catch (error: any) {
    console.error('Error getting category orders:', error);
    return {
      success: false,
      message: error.message || 'Failed to get category orders'
    };
  }
}

/**
 * Save category orders for an entity type
 */
export async function saveCategoryOrders(
  entityType: EntityType,
  categories: CustomFieldCategoryOrder[],
  campusId?: string
): Promise<ApiResponse> {
  try {
    return await apiRequest(`/custom-field-category-orders/${entityType}`, {
      method: 'POST',
      body: JSON.stringify({
        categories,
        campus_id: campusId
      })
    });
  } catch (error: any) {
    console.error('Error saving category orders:', error);
    return {
      success: false,
      message: error.message || 'Failed to save category orders'
    };
  }
}
