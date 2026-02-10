import { getAuthToken } from './schools'
import { simpleFetch } from './abortable-fetch'
import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  retryOnAuthFailure = true
): Promise<ApiResponse<T>> {
  const token = await getAuthToken()

  // If no token after retries, return auth error
  if (!token) {
    return {
      success: false,
      error: 'Authentication required'
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }

  try {
    const response = await simpleFetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      timeout: 25000,
      cache: 'no-store',
    })

    // Handle 401/403 - authentication/authorization issues
    if ((response.status === 401 || response.status === 403) && retryOnAuthFailure) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return apiRequest<T>(endpoint, options, false)
    }

    return await response.json()
  } catch {
    // Silent fail - no logging
    return {
      success: false,
      error: 'Network error'
    }
  }
}

export interface DashboardStats {
  totalSchools: number
  activeSchools: number
  suspendedSchools: number
  totalRevenue: number
  totalBillings: number
  paidBillings: number
  pendingBillings: number
  overdueBillings: number
}

export interface MonthlyGrowth {
  month: string
  schools: number
}

export interface MonthlyRevenue {
  month: string
  revenue: number
  subscriptions: number
}

export const dashboardApi = {
  /**
   * Get dashboard statistics
   */
  getStats: async () => {
    return apiRequest<DashboardStats>('/dashboard/stats')
  },

  /**
   * Get school growth data (monthly)
   */
  getSchoolGrowth: async (year?: number) => {
    const params = year ? `?year=${year}` : ''
    return apiRequest<MonthlyGrowth[]>(`/dashboard/school-growth${params}`)
  },

  /**
   * Get revenue data (monthly)
   */
  getRevenue: async (year?: number) => {
    const params = year ? `?year=${year}` : ''
    return apiRequest<MonthlyRevenue[]>(`/dashboard/revenue${params}`)
  },

  /**
   * Get recent schools
   */
  getRecentSchools: async (limit: number = 4) => {
    return apiRequest<any[]>(`/dashboard/recent-schools?limit=${limit}`)
  },
}
