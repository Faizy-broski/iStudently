import { apiRequest } from './index'
import { createClient } from '@/lib/supabase/client'

export interface SidebarConfig {
  id: string
  scope: 'superadmin' | 'school' | 'campus'
  school_id: string | null
  campus_id: string | null
  bg_color: string | null
  bg_image_url: string | null
  bg_image_opacity: number
  created_at: string
  updated_at: string
}

export interface UpdateSidebarConfigDTO {
  bg_color?: string | null
  bg_image_url?: string | null
  bg_image_opacity?: number
}

export async function getSuperadminSidebarConfig() {
  return apiRequest<SidebarConfig>('/sidebar-config/superadmin')
}

export async function updateSuperadminSidebarConfig(dto: UpdateSidebarConfigDTO) {
  return apiRequest<SidebarConfig>('/sidebar-config/superadmin', {
    method: 'PUT',
    body: JSON.stringify(dto),
  })
}

export async function resetSuperadminSidebarConfig() {
  return apiRequest<SidebarConfig>('/sidebar-config/superadmin/reset', {
    method: 'POST',
  })
}

export async function getSchoolSidebarConfig(schoolId: string) {
  return apiRequest<SidebarConfig>(`/sidebar-config/school/${schoolId}`)
}

export async function updateSchoolSidebarConfig(
  schoolId: string,
  dto: UpdateSidebarConfigDTO
) {
  return apiRequest<SidebarConfig>(`/sidebar-config/school/${schoolId}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  })
}

export async function resetSchoolSidebarConfig(schoolId: string) {
  return apiRequest<SidebarConfig>(`/sidebar-config/school/${schoolId}/reset`, {
    method: 'POST',
  })
}

export async function getCampusSidebarConfig(campusId: string) {
  return apiRequest<SidebarConfig>(`/sidebar-config/campus/${campusId}`)
}

export async function updateCampusSidebarConfig(
  campusId: string,
  dto: UpdateSidebarConfigDTO
) {
  return apiRequest<SidebarConfig>(`/sidebar-config/campus/${campusId}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  })
}

export async function resetCampusSidebarConfig(campusId: string) {
  return apiRequest<SidebarConfig>(`/sidebar-config/campus/${campusId}/reset`, {
    method: 'POST',
  })
}

export async function getMySidebarConfig() {
  return apiRequest<SidebarConfig>('/sidebar-config/my')
}

// Upload a sidebar background image directly to Supabase Storage.
// Uses the existing 'school-logos' bucket under a 'sidebar-bg/' prefix path.
// scope: 'superadmin', school_id, or campus_id string.
export async function uploadSidebarImage(
  file: File,
  scope: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const supabase = createClient()
    const fileExt = file.name.split('.').pop() ?? 'jpg'
    const safeName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 40)
    const fileName = `${Date.now()}-${safeName}.${fileExt}`
    // Path: sidebar-bg/{scope}/{filename}  inside the school-logos bucket
    const filePath = `sidebar-bg/${scope}/${fileName}`

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
