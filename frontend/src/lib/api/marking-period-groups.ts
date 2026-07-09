import { apiRequest } from '@/lib/api'

// ============================================================================
// TYPES
// ============================================================================

export interface MarkingPeriodGroup {
  id: string
  school_id: string
  campus_id?: string | null
  name: string
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateMarkingPeriodGroupData {
  name: string
  campus_id?: string | null
}

export interface UpdateMarkingPeriodGroupData {
  name?: string
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

export async function getMarkingPeriodGroups(campusId?: string): Promise<MarkingPeriodGroup[]> {
  const params = new URLSearchParams()
  if (campusId) params.append('campus_id', campusId)

  const query = params.toString() ? `?${params.toString()}` : ''
  const response = await apiRequest<MarkingPeriodGroup[]>(`/marking-period-groups${query}`)
  if (!response.success || !response.data) throw new Error(response.error || 'Failed to fetch')
  return response.data
}

export async function getMarkingPeriodGroupById(id: string): Promise<MarkingPeriodGroup> {
  const response = await apiRequest<MarkingPeriodGroup>(`/marking-period-groups/${id}`)
  if (!response.success || !response.data) throw new Error(response.error || 'Failed to fetch')
  return response.data
}

export async function createMarkingPeriodGroup(data: CreateMarkingPeriodGroupData): Promise<MarkingPeriodGroup> {
  const response = await apiRequest<MarkingPeriodGroup>('/marking-period-groups', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!response.success || !response.data) throw new Error(response.error || 'Failed to create')
  return response.data
}

export async function updateMarkingPeriodGroup(
  id: string,
  data: UpdateMarkingPeriodGroupData
): Promise<MarkingPeriodGroup> {
  const response = await apiRequest<MarkingPeriodGroup>(`/marking-period-groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  if (!response.success || !response.data) throw new Error(response.error || 'Failed to update')
  return response.data
}

export async function deleteMarkingPeriodGroup(id: string): Promise<void> {
  const response = await apiRequest<void>(`/marking-period-groups/${id}`, {
    method: 'DELETE',
  })
  if (!response.success) throw new Error(response.error || 'Failed to delete')
}
