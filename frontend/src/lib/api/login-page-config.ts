import { apiRequest } from './index'
import { createClient } from '@/lib/supabase/client'
import { API_URL } from '@/config/api'

export interface LoginPageConfig {
  background_type: 'gradient' | 'color' | 'image'
  gradient_from: string
  gradient_to: string
  background_color: string
  background_image_url: string | null
  background_image_opacity: number
  text_color_left: string
  text_color_right: string
  logo_url: string | null
  form_offset_x: number
  form_offset_y: number
  form_width: number
}

export const DEFAULT_LOGIN_PAGE_CONFIG: LoginPageConfig = {
  background_type: 'gradient',
  gradient_from: '#57A3CC',
  gradient_to: '#022172',
  background_color: '#022172',
  background_image_url: null,
  background_image_opacity: 1,
  text_color_left: '#022172',
  text_color_right: '#ffffff',
  logo_url: null,
  form_offset_x: 0,
  form_offset_y: 0,
  form_width: 448,
}

// Public — called from the unauthenticated /auth/login page, so it cannot use
// apiRequest() (which requires a session token to already exist).
export async function getLoginPageConfig(): Promise<LoginPageConfig> {
  try {
    const response = await fetch(`${API_URL}/login-page-config`)
    const data = await response.json()
    if (!data?.success) return DEFAULT_LOGIN_PAGE_CONFIG
    return { ...DEFAULT_LOGIN_PAGE_CONFIG, ...data.data }
  } catch {
    return DEFAULT_LOGIN_PAGE_CONFIG
  }
}

export async function updateLoginPageConfig(
  dto: Partial<LoginPageConfig>
) {
  return apiRequest<LoginPageConfig>('/login-page-config', {
    method: 'PUT',
    body: JSON.stringify(dto),
  })
}

export async function resetLoginPageConfig() {
  return apiRequest<LoginPageConfig>('/login-page-config/reset', {
    method: 'POST',
  })
}

// Upload a login page background/logo image directly to Supabase Storage.
// Uses the existing 'school-logos' bucket under a 'login-page/' prefix.
export async function uploadLoginPageImage(
  file: File,
  kind: 'background' | 'logo'
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const supabase = createClient()
    const fileExt = file.name.split('.').pop() ?? 'jpg'
    const safeName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 40)
    const fileName = `${Date.now()}-${safeName}.${fileExt}`
    const filePath = `login-page/${kind}/${fileName}`

    const { data, error } = await supabase.storage
      .from('school-logos')
      .upload(filePath, file, { cacheControl: '3600', upsert: false })

    if (error) return { success: false, error: error.message }

    const {
      data: { publicUrl },
    } = supabase.storage.from('school-logos').getPublicUrl(data.path)

    return { success: true, url: publicUrl }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to upload image',
    }
  }
}
