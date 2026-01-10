const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * Get auth token from Supabase session with retry logic
 * Properly handles session restoration from refresh token
 */
export async function getAuthToken(retryCount = 0): Promise<string | null> {
  if (typeof window === 'undefined') return null
  
  const { createClient } = await import('@/lib/supabase/client')
  const supabase = createClient()
  
  // First, try getUser() which properly waits for session restoration
  // This is important when refresh token is being used
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError) {
    console.warn('⚠️ Auth error:', userError.message)
    // If there's an auth error, don't retry - session is invalid
    return null
  }
  
  // If we have a user, get the session which should now be ready
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  
  // If we have a valid session, return the token
  if (session?.access_token) {
    console.log('✅ Auth token obtained successfully')
    return session.access_token
  }
  
  // If no session and we haven't retried, wait a bit and try again
  // This handles edge cases where session is still being set up
  if (retryCount < 5) {
    const delay = 200 * (retryCount + 1) // Progressive delay: 200ms, 400ms, 600ms, 800ms, 1000ms
    console.log(`⏳ Waiting for session... retry ${retryCount + 1}/5 (${delay}ms)`)
    await new Promise(resolve => setTimeout(resolve, delay))
    return getAuthToken(retryCount + 1)
  }
  
  console.warn('⚠️ No auth token available after retries')
  return null
}

/**
 * Make authenticated API request with retry logic
 */
async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  retryOnAuthFailure = true
): Promise<ApiResponse<T>> {
  const token = await getAuthToken()

  console.log('🔐 API Request Debug:', {
    endpoint,
    hasToken: !!token,
    tokenPreview: token ? `${token.substring(0, 20)}...` : 'No token'
  })

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      // Add cache control to prevent stale data
      cache: 'no-store',
    })

    // Handle 401/403 - authentication/authorization issues
    if ((response.status === 401 || response.status === 403) && retryOnAuthFailure && token) {
      console.warn('⚠️ Auth failed, retrying with fresh token...')
      // Wait a moment and retry with a fresh token
      await new Promise(resolve => setTimeout(resolve, 500))
      return apiRequest<T>(endpoint, options, false) // Don't retry again
    }

    const data = await response.json()
    
    console.log('📡 API Response:', {
      endpoint,
      status: response.status,
      success: data.success,
      error: data.error
    })
    
    return data
  } catch (error: unknown) {
    console.error('❌ API Request Failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    }
  }
}

// School API endpoints
export const schoolApi = {
  /**
   * Onboard a new school with admin credentials and billing
   */
  onboard: async (data: {
    school: {
      name: string
      slug: string
      contact_email: string
      address: string
      website?: string | null
      logo_url?: string | null
      settings?: {
        grading_scale: number
        currency: string
        library: {
          max_books: number
          fine_per_day: number
        }
      }
      modules?: {
        food_service: boolean
        discipline: boolean
        billing: boolean
        activities: boolean
      }
    }
    admin: {
      email: string
      password: string
      first_name: string
      last_name: string
    }
    billing?: {
      billing_plan_id: string
      billing_cycle: "Monthly" | "Quarterly" | "Yearly"
      amount: number
      start_date: string
      due_date: string
      payment_status: "paid" | "unpaid" | "pending"
    }
  }) => {
    return apiRequest('/schools/onboard', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  /**
   * Get all schools
   */
  getAll: async (filters?: { status?: string }) => {
    const query = filters?.status ? `?status=${filters.status}` : ''
    return apiRequest(`/schools${query}`)
  },

  /**
   * Get school by ID
   */
  getById: async (id: string) => {
    return apiRequest(`/schools/${id}`)
  },

  /**
   * Get school by slug
   */
  getBySlug: async (slug: string) => {
    return apiRequest(`/schools/slug/${slug}`)
  },

  /**
   * Create new school
   */
  create: async (data: {
    name: string
    slug: string
    contact_email: string
    address?: string
    website?: string
    logo_url?: string
  }) => {
    return apiRequest('/schools', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  /**
   * Update school
   */
  update: async (id: string, data: Partial<{
    name: string
    contact_email: string
    address: string
    website: string
    logo_url: string
    status: 'active' | 'suspended'
  }>) => {
    return apiRequest(`/schools/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  },

  /**
   * Update school status
   */
  updateStatus: async (id: string, status: 'active' | 'suspended') => {
    return apiRequest(`/schools/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    })
  },

  /**
   * Get school admin information
   */
  getAdmin: async (schoolId: string) => {
    return apiRequest(`/schools/${schoolId}/admin`)
  },

  /**
   * Update school admin information
   */
  updateAdmin: async (schoolId: string, data: {
    admin_name?: string
    admin_email?: string
    password?: string
  }) => {
    return apiRequest(`/schools/${schoolId}/admin`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  },

  /**
   * Delete (suspend) school
   */
  delete: async (id: string) => {
    return apiRequest(`/schools/${id}`, {
      method: 'DELETE'
    })
  },

  /**
   * Get school statistics
   */
  getStats: async () => {
    return apiRequest('/schools/stats')
  },

  /**
   * Get count by status
   */
  getCountByStatus: async () => {
    return apiRequest('/schools/count-by-status')
  }
}

/**
 * Simplified onboard school function
 */
export async function onboardSchool(data: {
  school: {
    name: string
    slug: string
    contact_email: string
    address: string
    website?: string | null
    logo_url?: string | null
    settings?: any
    modules?: any
  }
  admin: {
    email: string
    password: string
    first_name: string
    last_name: string
  }
  billing?: {
    subscription_plan: string
    billing_cycle: string
    amount: number
    start_date: string
    due_date: string
    payment_status: string
  }
}) {
  const response = await schoolApi.onboard(data)
  
  if (!response.success) {
    throw new Error(response.error || 'Failed to onboard school')
  }
  
  return response.data
}
