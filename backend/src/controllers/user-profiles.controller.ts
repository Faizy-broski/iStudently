import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { UserProfilesService } from '../services/user-profiles.service'
import { UserRole } from '../types'

const service = new UserProfilesService()

export const listProfiles = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID not found' })

    const profiles = await service.listProfiles(schoolId)
    return res.json({ success: true, data: profiles })
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message })
  }
}

export const listRoles = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID not found' })

    const roles = await service.listRoles(schoolId)
    return res.json({ success: true, data: roles })
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message })
  }
}

export const listStandaloneProfiles = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID not found' })

    const profiles = await service.listStandaloneProfiles(schoolId)
    return res.json({ success: true, data: profiles })
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message })
  }
}

export const createProfileFromRole = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const schoolId = req.profile?.school_id
    const userId = req.profile?.id
    if (!schoolId || !userId) return res.status(400).json({ success: false, error: 'Unauthorized' })

    const { name, role_id } = req.body
    if (!name || !role_id) {
      return res.status(400).json({ success: false, error: 'name and role_id are required' })
    }

    const profile = await service.createProfileFromRole(schoolId, name, role_id, userId)
    return res.status(201).json({ success: true, data: profile })
  } catch (error: any) {
    const msg = error.message || ''
    const status = msg.includes('not found') ? 404 : msg.includes('unique') || msg.includes('duplicate') ? 409 : 500
    return res.status(status).json({ success: false, error: msg })
  }
}

export const cloneForStaff = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'Unauthorized' })

    const { roleId } = req.params
    const { staff_id } = req.body
    if (!staff_id) return res.status(400).json({ success: false, error: 'staff_id is required' })

    const profile = await service.cloneRoleForStaff(roleId, schoolId, staff_id)
    return res.status(201).json({ success: true, data: profile })
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 500
    return res.status(status).json({ success: false, error: error.message })
  }
}

export const removeStaffProfile = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'Unauthorized' })

    const { staffId } = req.params
    await service.removeStaffProfile(staffId, schoolId)
    return res.json({ success: true })
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 500
    return res.status(status).json({ success: false, error: error.message })
  }
}

export const createProfile = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const schoolId = req.profile?.school_id
    const userId = req.profile?.id
    if (!schoolId || !userId) {
      return res.status(400).json({ success: false, error: 'Unauthorized' })
    }

    const { name, base_role } = req.body
    if (!name || !base_role) {
      return res.status(400).json({ success: false, error: 'name and base_role are required' })
    }

    const validRoles: UserRole[] = ['admin', 'teacher', 'student', 'parent', 'staff', 'librarian']
    if (!validRoles.includes(base_role)) {
      return res.status(400).json({ success: false, error: 'Invalid base_role' })
    }

    const profile = await service.createProfile(schoolId, name, base_role, userId)
    return res.status(201).json({ success: true, data: profile })
  } catch (error: any) {
    const msg = error.message || ''
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return res.status(409).json({ success: false, error: 'A profile with that name already exists' })
    }
    return res.status(500).json({ success: false, error: msg })
  }
}

export const updateProfile = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'Unauthorized' })

    const { id } = req.params
    const { name, base_role } = req.body
    if (!name && !base_role) {
      return res.status(400).json({ success: false, error: 'name or base_role is required' })
    }

    const profile = await service.updateProfile(id, schoolId, { name, base_role })
    return res.json({ success: true, data: profile })
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 500
    return res.status(status).json({ success: false, error: error.message })
  }
}

export const deleteProfile = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'Unauthorized' })

    const { id } = req.params
    await service.deleteProfile(id, schoolId)
    return res.json({ success: true })
  } catch (error: any) {
    const msg = error.message || ''
    const status = msg.includes('not found') ? 404 : msg.includes('cannot be deleted') ? 403 : 500
    return res.status(status).json({ success: false, error: msg })
  }
}

export const getPermissions = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'Unauthorized' })

    const { id } = req.params
    const permissions = await service.getPermissions(id, schoolId)
    return res.json({ success: true, data: permissions })
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 500
    return res.status(status).json({ success: false, error: error.message })
  }
}

export const updatePermissions = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'Unauthorized' })

    const { id } = req.params
    const { permissions } = req.body
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ success: false, error: 'permissions must be an array' })
    }

    await service.upsertPermissions(id, schoolId, permissions)
    return res.json({ success: true })
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 500
    return res.status(status).json({ success: false, error: error.message })
  }
}

export const getMyPermissions = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const userProfileId = req.profile?.user_profile_id
    if (!userProfileId) {
      // Admin or unassigned staff — full access, no filtering
      return res.json({ success: true, data: null })
    }

    const permissions = await service.getMyPermissions(userProfileId)
    return res.json({ success: true, data: permissions })
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message })
  }
}

export const assignProfile = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'Unauthorized' })

    const { staffId } = req.params
    const { profile_id } = req.body

    await service.assignProfile(staffId, schoolId, profile_id || null)
    return res.json({ success: true })
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 500
    return res.status(status).json({ success: false, error: error.message })
  }
}
