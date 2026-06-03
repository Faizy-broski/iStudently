import { Request, Response } from 'express'
import * as sidebarConfigService from '../services/sidebar-config.service'
import { ApiResponse } from '../types'

interface AuthRequest extends Request {
  profile?: {
    id: string
    school_id: string | null
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

export const getMyConfig = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const role = req.profile?.role ?? ''
    const schoolId = req.profile?.school_id ?? null
    const config = await sidebarConfigService.getMyConfig(role, schoolId)
    res.json({ success: true, data: config } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}
