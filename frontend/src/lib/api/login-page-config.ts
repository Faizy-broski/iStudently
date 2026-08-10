import { apiRequest } from './index'
import { API_URL } from '@/config/api'
import { uploadImage } from './media-upload'

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
  // Text content overrides — blank means "use the built-in default translation"
  title_en: string
  title_ar: string
  subtitle_en: string
  subtitle_ar: string
  heading_en: string
  heading_ar: string
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
  title_en: '',
  title_ar: '',
  subtitle_en: '',
  subtitle_ar: '',
  heading_en: '',
  heading_ar: '',
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

// Upload a login page background/logo image via the backend's media-upload
// endpoint (service-role Supabase client). Super admins have no school_id,
// so a direct browser-side upload to Storage was rejected by the
// per-school RLS policy on the 'school-logos' bucket — the backend upload
// endpoint already special-cases super_admin (uploads under a 'system'
// folder), so it works regardless of the caller's role.
export async function uploadLoginPageImage(
  file: File,
  _kind: 'background' | 'logo'
): Promise<{ success: boolean; url?: string; error?: string }> {
  const result = await uploadImage(file)
  if (!result.success || !result.data) {
    return { success: false, error: result.error || 'Failed to upload image' }
  }
  return { success: true, url: result.data.url }
}
