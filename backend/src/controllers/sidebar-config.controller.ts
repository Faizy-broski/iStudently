import { Request, Response } from 'express'
import * as sidebarConfigService from '../services/sidebar-config.service'
import { ApiResponse } from '../types'

interface AuthRequest extends Request {
  profile?: {
    id: string
    school_id: string | null
    campus_id?: string | null
    role: string
  }
}

export const getSuperadminConfig = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const config = await sidebarConfigService.getSuperadminConfig()
    res.json({ success: true, data: config } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}

export const updateSuperadminConfig = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { bg_color, bg_image_url, bg_image_opacity } = req.body

    const dto: sidebarConfigService.UpdateSidebarConfigDTO = {}
    if (bg_color !== undefined) dto.bg_color = bg_color || null
    if (bg_image_url !== undefined) dto.bg_image_url = bg_image_url || null
    if (bg_image_opacity !== undefined) dto.bg_image_opacity = Number(bg_image_opacity)

    const config = await sidebarConfigService.upsertSuperadminConfig(dto)
    res.json({
      success: true,
      data: config,
      message: 'Sidebar config updated',
    } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}

export const resetSuperadminConfig = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    await sidebarConfigService.resetConfig('superadmin')
    const config = await sidebarConfigService.getSuperadminConfig()
    res.json({
      success: true,
      data: config,
      message: 'Sidebar config reset to defaults',
    } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}

export const getSchoolConfig = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { schoolId } = req.params

    // Non-super-admins can only read config for their own school
    if (req.profile?.role !== 'super_admin' && req.profile?.school_id !== schoolId) {
      res.status(403).json({ success: false, error: 'Forbidden' } as ApiResponse)
      return
    }

    const config = await sidebarConfigService.getSchoolConfig(schoolId)
    res.json({ success: true, data: config } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}

export const updateSchoolConfig = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { schoolId } = req.params

    // Non-super-admins can only update config for their own school
    if (req.profile?.role !== 'super_admin' && req.profile?.school_id !== schoolId) {
      res.status(403).json({ success: false, error: 'Forbidden' } as ApiResponse)
      return
    }

    const { bg_color, bg_image_url, bg_image_opacity } = req.body

    const dto: sidebarConfigService.UpdateSidebarConfigDTO = {}
    if (bg_color !== undefined) dto.bg_color = bg_color || null
    if (bg_image_url !== undefined) dto.bg_image_url = bg_image_url || null
    if (bg_image_opacity !== undefined) dto.bg_image_opacity = Number(bg_image_opacity)

    const config = await sidebarConfigService.upsertSchoolConfig(schoolId, dto)
    res.json({
      success: true,
      data: config,
      message: 'Sidebar config updated',
    } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}

export const resetSchoolConfig = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { schoolId } = req.params

    if (req.profile?.role !== 'super_admin' && req.profile?.school_id !== schoolId) {
      res.status(403).json({ success: false, error: 'Forbidden' } as ApiResponse)
      return
    }

    await sidebarConfigService.resetConfig('school', schoolId)
    const config = await sidebarConfigService.getSchoolConfig(schoolId)
    res.json({
      success: true,
      data: config,
      message: 'Sidebar config reset to defaults',
    } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}

export const getCampusConfig = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { campusId } = req.params

    // Verify the campus belongs to the admin's school (super_admin bypasses)
    if (req.profile?.role !== 'super_admin') {
      const belongs = await verifyCampusBelongsToSchool(campusId, req.profile?.school_id ?? null)
      if (!belongs) {
        res.status(403).json({ success: false, error: 'Forbidden' } as ApiResponse)
        return
      }
    }

    const config = await sidebarConfigService.getCampusConfig(campusId)
    res.json({ success: true, data: config } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}

export const updateCampusConfig = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { campusId } = req.params
    const schoolId = req.profile?.school_id ?? null

    if (req.profile?.role !== 'super_admin') {
      const belongs = await verifyCampusBelongsToSchool(campusId, schoolId)
      if (!belongs) {
        res.status(403).json({ success: false, error: 'Forbidden' } as ApiResponse)
        return
      }
    }

    const { bg_color, bg_image_url, bg_image_opacity } = req.body

    const dto: sidebarConfigService.UpdateSidebarConfigDTO = {}
    if (bg_color !== undefined) dto.bg_color = bg_color || null
    if (bg_image_url !== undefined) dto.bg_image_url = bg_image_url || null
    if (bg_image_opacity !== undefined) dto.bg_image_opacity = Number(bg_image_opacity)

    // For super_admin we need to look up the campus's parent school_id
    const resolvedSchoolId = schoolId ?? (await resolveCampusSchoolId(campusId))
    if (!resolvedSchoolId) {
      res.status(400).json({ success: false, error: 'Could not resolve school for campus' } as ApiResponse)
      return
    }

    const config = await sidebarConfigService.upsertCampusConfig(campusId, resolvedSchoolId, dto)
    res.json({
      success: true,
      data: config,
      message: 'Campus sidebar config updated',
    } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}

export const resetCampusConfig = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { campusId } = req.params
    const schoolId = req.profile?.school_id ?? null

    if (req.profile?.role !== 'super_admin') {
      const belongs = await verifyCampusBelongsToSchool(campusId, schoolId)
      if (!belongs) {
        res.status(403).json({ success: false, error: 'Forbidden' } as ApiResponse)
        return
      }
    }

    const resolvedSchoolId = schoolId ?? (await resolveCampusSchoolId(campusId))
    if (!resolvedSchoolId) {
      res.status(400).json({ success: false, error: 'Could not resolve school for campus' } as ApiResponse)
      return
    }

    await sidebarConfigService.resetConfig('campus', resolvedSchoolId, campusId)
    const config = await sidebarConfigService.getCampusConfig(campusId)
    res.json({
      success: true,
      data: config,
      message: 'Campus sidebar config reset to defaults',
    } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}

export const getMyConfig = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const role = req.profile?.role ?? ''
    const schoolId = req.profile?.school_id ?? null
    const campusId = req.profile?.campus_id ?? null
    const config = await sidebarConfigService.getMyConfig(role, schoolId, campusId)
    res.json({ success: true, data: config } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

import { supabase } from '../config/supabase'

async function verifyCampusBelongsToSchool(
  campusId: string,
  schoolId: string | null
): Promise<boolean> {
  if (!schoolId) return false
  const { data } = await supabase
    .from('schools')
    .select('id, parent_school_id')
    .eq('id', campusId)
    .single()
  if (!data) return false
  return data.parent_school_id === schoolId || data.id === schoolId
}

async function resolveCampusSchoolId(campusId: string): Promise<string | null> {
  const { data } = await supabase
    .from('schools')
    .select('parent_school_id, id')
    .eq('id', campusId)
    .single()
  if (!data) return null
  return data.parent_school_id ?? data.id
}
