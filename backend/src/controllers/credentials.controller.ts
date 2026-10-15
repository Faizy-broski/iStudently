import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { supabase } from '../config/supabase'
import * as usernameService from '../services/username.service'
import { ApiResponse } from '../types'

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

export const bulkGetOrCreateCredentials = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) {
      res.status(403).json({ success: false, error: 'School context required' } as ApiResponse)
      return
    }

    const profileIds: string[] = Array.isArray(req.body?.profile_ids) ? req.body.profile_ids : []
    if (!profileIds.length) {
      res.json({ success: true, data: { credentials: [] } } as ApiResponse)
      return
    }

    // Resolving a profile with no stored credentials yet calls Supabase Auth's
    // admin API (a real network round-trip) plus a username-uniqueness loop —
    // sequentially awaiting that per person, one at a time, made a moderately
    // sized school's worth of profiles (99 students, mostly first-time) take
    // long enough to hit the reverse proxy's timeout (504). Same bounded
    // concurrency already used by miqat/cards.controller.ts's qrBatch issuing
    // loop, for the same reason.
    const credentials: { id: string; username: string; password: string }[] = []
    for (let i = 0; i < profileIds.length; i += 10) {
      await Promise.all(
        profileIds.slice(i, i + 10).map(async (profileId) => {
          try {
            const { username, password } = await usernameService.getOrCreateStoredCredentials(
              profileId,
              schoolId
            )
            credentials.push({ id: profileId, username, password })
          } catch (err: any) {
            console.error('bulkGetOrCreateCredentials failed for profileId', profileId, err.message)
            // Continue — don't let one failure break the batch
          }
        })
      )
    }

    res.json({ success: true, data: { credentials } } as ApiResponse)
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

        // Sync Supabase auth password FIRST — only persist the new username
        // once the sync succeeds, so we never store credentials that don't work.
        const { error: authError } = await supabase.auth.admin
          .updateUserById(profile.id, { password: plainPassword })
        if (authError) throw authError

        await supabase
          .from('profiles')
          .update({
            username,
            force_password_change: true,
            username_generated_at: new Date().toISOString(),
          })
          .eq('id', profile.id)

        // Best-effort only — must not undo the auth password change above if it fails.
        await usernameService.syncPasswordDisplayCache(profile.id, plainPassword)

        assigned++
      } catch (err: any) {
        console.error('bulkAssignUsernames failed for profile', profile.id, err?.message ?? err)
        // Continue — don't let one failure break the batch
      }
    }

    res.json({ success: true, data: { assigned } } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}
