import { Response } from 'express'

import { supabase } from '../config/supabase'
import { AuthRequest } from '../middlewares/auth.middleware'
import { schoolRootId } from '../utils/campus-validation'
import * as jg from '../services/jahbadh/grades.service'
import * as att from '../services/jahbadh/attendance.service'
import * as homeroom from '../services/jahbadh/homeroom.service'
import * as imp from '../services/jahbadh/import.service'
import * as roll from '../services/jahbadh/rollover.service'

/**
 * Jahbadh Wave 2 data workflows: name import (#25), daily attendance (#26), rollover (#29) and the
 * homeroom teacher (B9). Same response shape and error mapping as jahbadh-grades.controller.
 */

type Handler = (req: AuthRequest, res: Response) => Promise<unknown>

const handle = (fn: Handler) => async (req: AuthRequest, res: Response) => {
  try {
    const data = await fn(req, res)
    if (!res.headersSent) res.json({ success: true, data })
  } catch (err: any) {
    if (err instanceof jg.JgError) {
      return res.status(err.status).json({ success: false, error: err.message, code: err.code, details: err.details })
    }
    const missing = jg.isNotMigrated(err) ? String(err?.message ?? '').match(/jg_[a-z0-9_]+/)?.[0] ?? 'jahbadh' : null
    if (missing) {
      return res.status(503).json({ success: false, error: `Database update missing (${missing}). Run backend/migrations/jahbadh_wave2_data.sql.`, code: 'not_migrated' })
    }
    console.error('[jahbadh-data]', err)
    return res.status(500).json({ success: false, error: err?.message || 'Unexpected error' })
  }
}

const actorOf = (req: AuthRequest): jg.JgActor => ({ profileId: req.profile?.id, role: req.profile?.role, staffId: req.profile?.staff_id ?? null })

const ctxOf = (req: AuthRequest) =>
  jg.sectionContext(req.params.sectionId, req.profile?.school_id, actorOf(req), (req.query.academic_year_id as string) || req.body?.academic_year_id || null)

async function rootYear(req: AuthRequest): Promise<{ rootId: string; yearId: string }> {
  const rootId = await schoolRootId(req.profile?.school_id)
  if (!rootId) throw new jg.JgError(403, 'No school context')
  const wanted = (req.query.academic_year_id as string) || req.body?.academic_year_id || null
  let q = supabase.from('academic_years').select('id').eq('school_id', rootId)
  q = wanted ? q.eq('id', wanted) : q.eq('is_current', true)
  const { data } = await q.maybeSingle()
  if (!data) throw new jg.JgError(409, 'No current academic year', 'no_year')
  return { rootId, yearId: (data as any).id }
}

const importInput = (req: AuthRequest): imp.JgImportInput => {
  const file = (req as any).file as { buffer: Buffer; originalname?: string; mimetype?: string } | undefined
  let mapping = req.body?.mapping
  if (typeof mapping === 'string') {
    try { mapping = JSON.parse(mapping) } catch { throw new jg.JgError(400, 'mapping must be JSON', 'bad_mapping') }
  }
  const hasHeader = req.body?.has_header
  return {
    text: typeof req.body?.text === 'string' ? req.body.text : undefined,
    file: file ? { buffer: file.buffer, name: file.originalname, mimetype: file.mimetype } : undefined,
    has_header: hasHeader === undefined ? true : !(hasHeader === false || hasHeader === 'false' || hasHeader === '0'),
    mapping: mapping && typeof mapping === 'object' ? mapping : undefined,
  }
}

const stageQ = (req: AuthRequest) => (req.query.stage === undefined ? undefined : Number(req.query.stage))

export const jahbadhDataController = {
  // Name import (#25)
  importPreview: handle(async (req) => imp.previewImport(await ctxOf(req), importInput(req))),
  importApply: handle(async (req) => imp.applyImport(await ctxOf(req), importInput(req), actorOf(req))),

  // Daily attendance (#26)
  getCalendar: handle(async (req) => {
    const { rootId, yearId } = await rootYear(req)
    return att.getCalendar(rootId, yearId)
  }),
  saveCalendar: handle(async (req) => att.saveCalendar(await rootYear(req), req.body ?? {}, actorOf(req))),
  dailyAttendance: handle(async (req) => {
    const stage = stageQ(req)
    if (stage !== undefined && !Number.isInteger(stage)) throw new jg.JgError(400, 'stage must be 1–3')
    return att.getDailyAttendance(await ctxOf(req), stage, (req.query.month as string) || undefined)
  }),
  saveDailyAttendance: handle(async (req) => att.saveDailyAttendance(await ctxOf(req), req.body?.entries, actorOf(req))),

  // Rollover (#29)
  rolloverPreview: handle(async (req) => roll.previewRollover(await ctxOf(req))),
  rolloverApply: handle(async (req) => roll.applyRollover(await ctxOf(req), Array.isArray(req.body?.students) ? req.body.students : [], actorOf(req))),

  // Homeroom teacher (B9)
  getHomeroom: handle(async (req) => {
    const ctx = await ctxOf(req)
    return homeroom.getHomeroom(ctx.section.id, ctx.yearId)
  }),
  setHomeroom: handle(async (req) => {
    const ctx = await ctxOf(req)
    const staffId = req.body?.staff_id ?? null
    if (staffId !== null && typeof staffId !== 'string') throw new jg.JgError(400, 'staff_id must be a staff id or null')
    return homeroom.setHomeroom(ctx, staffId, actorOf(req), async (id) => {
      const { data } = await supabase.from('staff').select('school_id').eq('id', id).maybeSingle()
      return !!data && (await schoolRootId((data as any).school_id)) === ctx.rootId
    })
  }),
}
