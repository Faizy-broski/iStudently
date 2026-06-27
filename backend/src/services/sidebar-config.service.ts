import { supabase } from '../config/supabase'
import { ApiResponse } from '../types'

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
      campus_id: null,
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
      campus_id: null,
      bg_image_opacity: 0.15,
      ...dto,
    })
    .select()
    .single()

  // Race condition / duplicate: another request just inserted — retry as update
  if (error?.code === '23505') {
    const retry = await getSchoolConfig(schoolId)
    if (retry) {
      const { data: updated, error: updateErr } = await supabase
        .from('sidebar_configs')
        .update({ ...dto, updated_at: new Date().toISOString() })
        .eq('id', retry.id)
        .select()
        .single()
      if (updateErr) throw updateErr
      return updated
    }
  }

  if (error) throw error
  return data
}

export async function getCampusConfig(campusId: string): Promise<SidebarConfig | null> {
  const { data, error } = await supabase
    .from('sidebar_configs')
    .select('*')
    .eq('scope', 'campus')
    .eq('campus_id', campusId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function upsertCampusConfig(
  campusId: string,
  schoolId: string,
  dto: UpdateSidebarConfigDTO
): Promise<SidebarConfig> {
  const existing = await getCampusConfig(campusId)

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
      scope: 'campus',
      school_id: schoolId,
      campus_id: campusId,
      bg_image_opacity: 0.15,
      ...dto,
    })
    .select()
    .single()

  // Race condition / duplicate: another request just inserted — retry as update
  if (error?.code === '23505') {
    const retry = await getCampusConfig(campusId)
    if (retry) {
      const { data: updated, error: updateErr } = await supabase
        .from('sidebar_configs')
        .update({ ...dto, updated_at: new Date().toISOString() })
        .eq('id', retry.id)
        .select()
        .single()
      if (updateErr) throw updateErr
      return updated
    }
  }

  if (error) throw error
  return data
}

/**
 * Resolve effective config for an authenticated user.
 * Priority: campus config → school config → null (falls back to superadmin on the frontend)
 */
export async function getMyConfig(
  role: string,
  schoolId: string | null,
  campusId?: string | null
): Promise<SidebarConfig | null> {
  if (role === 'super_admin') {
    return getSuperadminConfig()
  }

  // Check campus-level config first (campus overrides school)
  if (campusId) {
    const campusConfig = await getCampusConfig(campusId)
    if (campusConfig) return campusConfig
  }

  if (schoolId) {
    return getSchoolConfig(schoolId)
  }

  return null
}

export async function resetConfig(scope: 'superadmin', schoolId?: null, campusId?: null): Promise<void>
export async function resetConfig(scope: 'school', schoolId: string, campusId?: null): Promise<void>
export async function resetConfig(scope: 'campus', schoolId: string, campusId: string): Promise<void>
export async function resetConfig(
  scope: 'superadmin' | 'school' | 'campus',
  schoolId?: string | null,
  campusId?: string | null
): Promise<void> {
  const dto: UpdateSidebarConfigDTO = {
    bg_color: null,
    bg_image_url: null,
    bg_image_opacity: 0.15,
  }

  if (scope === 'superadmin') {
    await upsertSuperadminConfig(dto)
  } else if (scope === 'school' && schoolId) {
    await upsertSchoolConfig(schoolId, dto)
  } else if (scope === 'campus' && campusId && schoolId) {
    await upsertCampusConfig(campusId, schoolId, dto)
  }
}
