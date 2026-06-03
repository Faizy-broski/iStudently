import { supabase } from '../config/supabase'
import { ApiResponse } from '../types'

export interface SidebarConfig {
  id: string
  scope: 'superadmin' | 'school'
  school_id: string | null
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

export async function getSuperadminConfig(): Promise<SidebarConfig | null> {
  const { data, error } = await supabase
    .from('sidebar_configs')
    .select('*')
    .eq('scope', 'superadmin')
    .maybeSingle()

  if (error) throw error
  return data
}

export async function upsertSuperadminConfig(
  dto: UpdateSidebarConfigDTO
): Promise<SidebarConfig> {
  const existing = await getSuperadminConfig()

  if (existing) {
    const { data, error } = await supabase
      .from('sidebar_configs')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('sidebar_configs')
    .insert({
      scope: 'superadmin',
      school_id: null,
      bg_image_opacity: 0.15,
      ...dto,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getSchoolConfig(schoolId: string): Promise<SidebarConfig | null> {
  const { data, error } = await supabase
    .from('sidebar_configs')
    .select('*')
    .eq('scope', 'school')
    .eq('school_id', schoolId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function upsertSchoolConfig(
  schoolId: string,
  dto: UpdateSidebarConfigDTO
): Promise<SidebarConfig> {
  const existing = await getSchoolConfig(schoolId)

  if (existing) {
    const { data, error } = await supabase
      .from('sidebar_configs')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('sidebar_configs')
    .insert({
      scope: 'school',
      school_id: schoolId,
      bg_image_opacity: 0.15,
      ...dto,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getMyConfig(
  role: string,
  schoolId: string | null
): Promise<SidebarConfig | null> {
  if (role === 'super_admin') {
    return getSuperadminConfig()
  }
  if (schoolId) {
    return getSchoolConfig(schoolId)
  }
  return null
}

export async function resetConfig(
  scope: 'superadmin',
  schoolId?: null
): Promise<void>
export async function resetConfig(
  scope: 'school',
  schoolId: string
): Promise<void>
export async function resetConfig(
  scope: 'superadmin' | 'school',
  schoolId?: string | null
): Promise<void> {
  const dto: UpdateSidebarConfigDTO = {
    bg_color: null,
    bg_image_url: null,
    bg_image_opacity: 0.15,
  }

  if (scope === 'superadmin') {
    await upsertSuperadminConfig(dto)
  } else if (schoolId) {
    await upsertSchoolConfig(schoolId, dto)
  }
}
