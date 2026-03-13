import { Request, Response } from 'express'
import type { AuthRequest } from '../middlewares/auth.middleware'
import { supabase } from '../config/supabase'
import { getICalLink, streamICalendar, type ICalType } from '../services/ical.service'

// ============================================================================
// Helpers
// ============================================================================

async function resolveSchoolAndCampus(req: Request): Promise<{
  schoolId: string | null
  campusId: string | null
}> {
  const profile = (req as AuthRequest).profile
  let schoolId = (req.query.school_id as string) || profile?.school_id || null
  const campusId = (req.query.campus_id as string) || null

  // If we have campus but no school, look up parent school
  if (!schoolId && campusId) {
    const { data } = await supabase
      .from('campuses')
      .select('parent_school_id')
      .eq('id', campusId)
      .single()
    if (data?.parent_school_id) schoolId = data.parent_school_id
  }

  return { schoolId, campusId }
}

// ============================================================================
// GET /api/ical/link
// Query: type (events|schedule), campus_id?
// Returns a signed subscribe URL for the calling admin
// ============================================================================

export async function getLink(req: Request, res: Response): Promise<void> {
  try {
    const { schoolId, campusId } = await resolveSchoolAndCampus(req)
    if (!schoolId) {
      res.status(400).json({ error: 'school_id is required' })
      return
    }

    const type = ((req.query.type as string) || 'events') as ICalType
    if (!['events', 'schedule'].includes(type)) {
      res.status(400).json({ error: 'type must be events or schedule' })
      return
    }

    const proto = req.headers['x-forwarded-proto'] || req.protocol
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost'
    const baseUrl = `${proto}://${host}`

    const result = await getICalLink({ schoolId, campusId, type, baseUrl })
    res.json({ data: result })
  } catch (err: any) {
    if (err.message === 'PLUGIN_INACTIVE') {
      res.status(403).json({ error: 'PLUGIN_INACTIVE' })
      return
    }
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

// ============================================================================
// GET /api/ical/subscribe/:token   (public — no auth required)
// Streams .ics file content
// ============================================================================

export async function subscribe(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.params
    const { content, name } = await streamICalendar(token)

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`)
    res.setHeader('Cache-Control', 'no-cache, no-store')
    res.send(content)
  } catch (err: any) {
    if (err.message === 'INVALID_TOKEN') {
      res.status(403).json({ error: 'Invalid or expired link' })
      return
    }
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
