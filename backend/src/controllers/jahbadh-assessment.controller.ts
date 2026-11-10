import { Response } from 'express'

import { AuthRequest } from '../middlewares/auth.middleware'
import * as core from '../services/jahbadh/control/core'
import * as ja from '../services/jahbadh/control/assessment'
import { renderBubbleSheets, renderErrorSlips } from '../services/jahbadh/control/assessment-print'
import * as jg from '../services/jahbadh/grades.service'
import * as qg from '../services/jahbadh/quiz-grading.service'

/**
 * Jahbadh assessment tools (Wave 6): exam-control answer keys, auto-grading, item analysis, answer
 * similarity, objectives, marking fairness, test archive, error slips and bubble sheets; plus teacher
 * quiz auto-grading into a grades column (#61). Same error mapping as the other Jahbadh controllers.
 */
type Handler = (req: AuthRequest, res: Response) => Promise<unknown>

const handle = (fn: Handler) => async (req: AuthRequest, res: Response) => {
  try {
    const data = await fn(req, res)
    if (!res.headersSent) res.json({ success: true, data })
  } catch (err: any) {
    if (err instanceof jg.JgError) return res.status(err.status).json({ success: false, error: err.message, code: err.code, details: err.details })
    const missing = jg.isNotMigrated(err) ? String(err?.message ?? '').match(/(jg|jc)_[a-z0-9_]+/)?.[0] ?? 'jahbadh' : null
    if (missing) {
      return res.status(503).json({ success: false, error: `Database update missing (${missing}). Run backend/migrations/jahbadh_wave6.sql.`, code: 'not_migrated' })
    }
    console.error('[jahbadh-assessment]', err)
    return res.status(500).json({ success: false, error: err?.message || 'Unexpected error' })
  }
}

const jcActor = (req: AuthRequest): core.JcActor => ({ profileId: req.profile?.id, role: req.profile?.role, schoolId: req.profile?.school_id })
const jcCtx = (req: AuthRequest) => core.sessionContext(req.params.sessionId, jcActor(req))
const jgActor = (req: AuthRequest): jg.JgActor => ({ profileId: req.profile?.id, role: req.profile?.role, staffId: req.profile?.staff_id ?? null })
const jgCtx = (req: AuthRequest) => jg.sectionContext(req.params.sectionId, req.profile?.school_id, jgActor(req), (req.query.academic_year_id as string) || null)
const entryOf = (v: unknown): 1 | 2 => (Number(v) === 2 ? 2 : 1)

const pdf = (res: Response, out: { pdf: Buffer; name: string; total?: number }) => {
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="${out.name}"`)
  if (out.total !== undefined) res.setHeader('X-Total-Count', String(out.total))
  res.send(out.pdf)
}

export const jahbadhAssessmentController = {
  // ---- exam control -------------------------------------------------------------------------------
  listKeys: handle(async (req) => ja.listKeys(await jcCtx(req))),
  saveKey: handle(async (req) => ja.saveKey(await jcCtx(req), req.body ?? {})),
  getKey: handle(async (req) => ja.getKey(await jcCtx(req), req.params.keyId)),
  deleteKey: handle(async (req) => ja.deleteKey(await jcCtx(req), req.params.keyId)),
  sheets: handle(async (req) => ja.sheets(await jcCtx(req), req.params.keyId)),
  saveSheets: handle(async (req) => ja.saveSheets(await jcCtx(req), req.params.keyId, req.body?.entries ?? [])),
  transferPreview: handle(async (req) => ja.transferPreview(await jcCtx(req), req.params.keyId, entryOf(req.query.entry))),
  transfer: handle(async (req) => ja.transfer(await jcCtx(req), req.params.keyId, entryOf(req.body?.entry))),
  analysis: handle(async (req) => {
    const v = String(req.query.version ?? 'all')
    return ja.analysis(await jcCtx(req), req.params.keyId, v === 'A' || v === 'B' ? v : 'all')
  }),
  similarity: handle(async (req) => {
    const a = Number(req.query.a)
    const b = Number(req.query.b)
    return ja.similarity(await jcCtx(req), req.params.keyId, a && b ? { a, b } : null)
  }),
  mastery: handle(async (req) => ja.mastery(await jcCtx(req), req.params.keyId)),
  errorSlips: handle(async (req, res) => pdf(res, await renderErrorSlips(await jcCtx(req), req.params.keyId))),
  bubbleSheets: handle(async (req, res) =>
    pdf(res, await renderBubbleSheets(await jcCtx(req), req.params.keyId, { committee_id: (req.query.committee_id as string) || null, offset: Number(req.query.offset) || 0 })),
  ),
  fairness: handle(async (req) => {
    const t = Number(req.query.threshold)
    return ja.fairness(await jcCtx(req), String(req.query.grade_level_id ?? ''), t > 0 && t < 1 ? t : 0.05)
  }),
  listArchive: handle(async (req) => ja.listArchive(await jcCtx(req))),
  getArchive: handle(async (req) => ja.getArchive(await jcCtx(req), req.params.archiveId)),
  archiveKey: handle(async (req) => ja.archiveKey(await jcCtx(req), req.params.keyId, req.body ?? {})),
  recallArchive: handle(async (req) => ja.recallArchive(await jcCtx(req), req.params.archiveId, req.body ?? {})),
  deleteArchive: handle(async (req) => ja.deleteArchive(await jcCtx(req), req.params.archiveId)),

  // ---- grades: teacher quiz auto-grading (#61) ------------------------------------------------------
  quizTargets: handle(async (req) => qg.quizTargets(await jgCtx(req))),
  listQuizKeys: handle(async (req) => qg.listQuizKeys(await jgCtx(req))),
  saveQuizKey: handle(async (req) => qg.saveQuizKey(await jgCtx(req), req.body ?? {}, jgActor(req))),
  getQuizKey: handle(async (req) => qg.getQuizKey(await jgCtx(req), req.params.quizKeyId)),
  deleteQuizKey: handle(async (req) => qg.deleteQuizKey(await jgCtx(req), req.params.quizKeyId, jgActor(req))),
  saveQuizAnswers: handle(async (req) => qg.saveQuizAnswers(await jgCtx(req), req.params.quizKeyId, req.body?.entries ?? [], jgActor(req))),
  commitPreview: handle(async (req) => qg.commitQuizKey(await jgCtx(req), req.params.quizKeyId, jgActor(req), true)),
  commit: handle(async (req) => qg.commitQuizKey(await jgCtx(req), req.params.quizKeyId, jgActor(req), false)),
}
