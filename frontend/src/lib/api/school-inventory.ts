import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getAuthToken()

  if (!token) {
    return { success: false, error: 'Authentication required. Please sign in.' }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    })

    const data = await response.json()

    if (response.status === 401) {
      await handleSessionExpiry()
      return { success: false, error: 'Session expired' }
    }

    if (!response.ok) {
      return { success: false, error: data?.error || `Request failed (${response.status})` }
    }

    return data
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Network error'
    return { success: false, error: message }
  }
}

// ---- Types ----

export type CategoryType = 'CATEGORY' | 'STATUS' | 'LOCATION' | 'PERSON'

export interface InventoryCategory {
  id: string
  school_id: string
  campus_id?: string
  category_type: CategoryType
  title: string
  sort_order?: number
  color?: string
  created_at: string
  updated_at: string
  item_count?: number
}

export interface InventoryItem {
  id: string
  school_id: string
  campus_id?: string
  title: string
  quantity: number
  comments?: string
  sort_order?: number
  created_by?: string
  created_at: string
  updated_at: string
  categories?: InventoryCategory[]
}

export interface InventorySnapshot {
  id: string
  school_id: string
  campus_id?: string
  title: string
  created_by?: string
  created_at: string
}

export interface SnapshotDetail extends InventorySnapshot {
  items: Array<{
    id: string
    original_item_id?: string
    title: string
    quantity: number
    comments?: string
    sort_order?: number
    categories: Array<{
      id: string
      category_type: CategoryType
      title: string
    }>
  }>
}

// ---- Category API ----

export async function getInventoryCategories(
  campusId?: string,
  type?: CategoryType
): Promise<InventoryCategory[]> {
  const params = new URLSearchParams()
  if (campusId) params.set('campus_id', campusId)
  if (type) params.set('type', type)
  const qs = params.toString() ? `?${params.toString()}` : ''
  const result = await apiRequest<InventoryCategory[]>(`/school-inventory/categories${qs}`)
  return result.data || []
}

export async function bulkSaveInventoryCategories(
  categories: Array<{
    id?: string
    category_type: CategoryType
    title: string
    sort_order?: number
    color?: string
  }>,
  existingIds: string[],
  campusId?: string
): Promise<InventoryCategory[]> {
  const result = await apiRequest<InventoryCategory[]>('/school-inventory/categories/bulk-save', {
    method: 'PUT',
    body: JSON.stringify({ categories, existing_ids: existingIds, campus_id: campusId }),
  })
  return result.data || []
}

export async function deleteInventoryCategory(id: string): Promise<boolean> {
  const result = await apiRequest(`/school-inventory/categories/${id}`, { method: 'DELETE' })
  return result.success
}

// ---- Item API ----

export async function getInventoryItems(
  campusId?: string,
  categoryId?: string
): Promise<InventoryItem[]> {
  const params = new URLSearchParams()
  if (campusId) params.set('campus_id', campusId)
  if (categoryId) params.set('category_id', categoryId)
  const qs = params.toString() ? `?${params.toString()}` : ''
  const result = await apiRequest<InventoryItem[]>(`/school-inventory/items${qs}`)
  return result.data || []
}

export async function getInventoryItemById(id: string): Promise<InventoryItem | null> {
  const result = await apiRequest<InventoryItem>(`/school-inventory/items/${id}`)
  return result.data || null
}

export async function bulkSaveInventoryItems(
  items: Array<{
    id?: string
    title: string
    quantity?: number
    comments?: string
    sort_order?: number
    category_ids?: string[]
  }>,
  existingIds: string[],
  campusId?: string
): Promise<InventoryItem[]> {
  const result = await apiRequest<InventoryItem[]>('/school-inventory/items/bulk-save', {
    method: 'PUT',
    body: JSON.stringify({ items, existing_ids: existingIds, campus_id: campusId }),
  })
  return result.data || []
}

export async function deleteInventoryItem(id: string): Promise<boolean> {
  const result = await apiRequest(`/school-inventory/items/${id}`, { method: 'DELETE' })
  return result.success
}

// ---- Snapshot API ----

export async function getInventorySnapshots(campusId?: string): Promise<InventorySnapshot[]> {
  const qs = campusId ? `?campus_id=${campusId}` : ''
  const result = await apiRequest<InventorySnapshot[]>(`/school-inventory/snapshots${qs}`)
  return result.data || []
}

export async function getInventorySnapshotDetail(id: string): Promise<SnapshotDetail | null> {
  const result = await apiRequest<SnapshotDetail>(`/school-inventory/snapshots/${id}`)
  return result.data || null
}

export async function createInventorySnapshot(
  title: string,
  campusId?: string
): Promise<InventorySnapshot | null> {
  const result = await apiRequest<InventorySnapshot>('/school-inventory/snapshots', {
    method: 'POST',
    body: JSON.stringify({ title, campus_id: campusId }),
  })
  return result.data || null
}

export async function deleteInventorySnapshot(id: string): Promise<boolean> {
  const result = await apiRequest(`/school-inventory/snapshots/${id}`, { method: 'DELETE' })
  return result.success
}
