import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { supabase } from '../config/supabase'
import * as usernameService from '../services/username.service'
import { ApiResponse } from '../types'
import bcrypt from 'bcrypt'

export const regenerateCredentials = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) {
      res.status(403).json({ success: false, error: 'School context required' } as ApiResponse)
      return
    }
    const { id: profileId } = req.params
    const { username, plainPassword } = await usernameService.regenerateCredentials(
      profileId,
      schoolId
    )
    res.json({ success: true, data: { username, plainPassword } } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}

export const getUsername = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const schoolId = req.profile?.school_id
    const role = req.profile?.role
    const { id: profileId } = req.params

    let query = supabase.from('profiles').select('username').eq('id', profileId)
    if (role !== 'super_admin' && schoolId) {
      query = query.eq('school_id', schoolId)
    }

    const { data, error } = await query.maybeSingle()
    if (error) throw error
    if (!data) {
      res.status(404).json({ success: false, error: 'Profile not found' } as ApiResponse)
      return
    }

    res.json({ success: true, data: { username: data.username } } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}

export const bulkAssignUsernames = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) {
      res.status(403).json({ success: false, error: 'School context required' } as ApiResponse)
      return
    }

    const { data: profiles, error: fetchError } = await supabase
      .from('profiles')
      .select('id')
      .eq('school_id', schoolId)
      .is('username', null)

    if (fetchError) throw fetchError
    if (!profiles?.length) {
      res.json({ success: true, data: { assigned: 0 } } as ApiResponse)
      return
    }

    let assigned = 0
    for (const profile of profiles) {
      try {
        const { username, plainPassword } = await usernameService.generateCredentials()
        const hashedPassword = await bcrypt.hash(plainPassword, 10)

        await supabase
          .from('profiles')
          .update({
            username,
            system_password: hashedPassword,
            force_password_change: true,
            username_generated_at: new Date().toISOString(),
          })
          .eq('id', profile.id)

        await supabase.auth.admin
          .updateUserById(profile.id, { password: plainPassword })
          .catch(() => {})

        assigned++
      } catch {
        // Continue — don't let one failure break the batch
      }
    }

    res.json({ success: true, data: { assigned } } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}
