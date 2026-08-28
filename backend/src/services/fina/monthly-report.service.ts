import cron from 'node-cron'
import puppeteer from 'puppeteer'
import { supabase } from '../../config/supabase'
import { registerFinaJobHandler } from './jobs-runner.service'
import { enqueueFinaJob } from '../../utils/fina-jobs'
import { CallerContext } from './types'

/**
 * Monthly compliance report (spec §18) — the one PDF in this module that's
 * generated server-side (headless Chrome via Puppeteer), since every other
 * PDF here is triggered by a live user in their own browser (jsPDF), but
 * this one runs unattended on a schedule with nobody present to render it
 * client-side. `--no-sandbox` is required for this to launch reliably in
 * this environment (the default launch hangs here); safe in this specific
 * context since Puppeteer only ever renders our own trusted HTML template
 * below, never arbitrary third-party content.
 */

const BUCKET = 'fina-media'

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

interface ReportMetrics {
  schoolName: string
  period: string
  postCountsByType: Record<string, number>
  approvedCount: number
  rejectedCount: number
  rejectionReasons: string[]
  emergencyCount: number
  consentCoverage: number // % of students with at least one active consent record
  consentLevelDistribution: Record<number, number>
  withdrawalCount: number
  blockedCount: number
  guardianActivationRate: number // % of guardians with at least one login-adjacent action this period (approximated via consent/comment activity)
}

async function computeMetrics(schoolId: string, period: string): Promise<ReportMetrics> {
  const [year, month] = period.split('-').map(Number)
  const periodStart = new Date(Date.UTC(year, month - 1, 1)).toISOString()
  const periodEnd = new Date(Date.UTC(year, month, 1)).toISOString()

  const { data: school } = await supabase.from('schools').select('name').eq('id', schoolId).maybeSingle()

  const { data: posts } = await supabase
    .from('fina_posts')
    .select('type, state, rejected_reason, is_emergency')
    .eq('school_id', schoolId)
    .gte('created_at', periodStart)
    .lt('created_at', periodEnd)

  const postCountsByType: Record<string, number> = {}
  let approvedCount = 0
  let rejectedCount = 0
  let emergencyCount = 0
  const rejectionReasons: string[] = []
  for (const p of posts || []) {
    postCountsByType[p.type] = (postCountsByType[p.type] || 0) + 1
    if (p.state === 'published') approvedCount++
    if (p.state === 'rejected') {
      rejectedCount++
      if (p.rejected_reason) rejectionReasons.push(p.rejected_reason)
    }
    if (p.is_emergency) emergencyCount++
  }

  const { data: students } = await supabase.from('students').select('id').eq('school_id', schoolId)
  const totalStudents = (students || []).length
  const studentIds = (students || []).map((s) => s.id)

  const { data: consents } = studentIds.length
    ? await supabase.from('fina_consents').select('student_id, level, status').in('student_id', studentIds).eq('status', 'active')
    : { data: [] as any[] }
  const studentsWithConsent = new Set((consents || []).map((c) => c.student_id))
  const consentCoverage = totalStudents > 0 ? Math.round((studentsWithConsent.size / totalStudents) * 100) : 0

  const consentLevelDistribution: Record<number, number> = {}
  for (const c of consents || []) {
    consentLevelDistribution[c.level] = (consentLevelDistribution[c.level] || 0) + 1
  }

  const { count: withdrawalCount } = studentIds.length
    ? await supabase
        .from('fina_consents')
        .select('id', { count: 'exact', head: true })
        .in('student_id', studentIds)
        .eq('status', 'withdrawn')
        .gte('withdrawn_at', periodStart)
        .lt('withdrawn_at', periodEnd)
    : { count: 0 }

  const { count: blockedCount } = await supabase
    .from('fina_audit_log')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('action', 'media.blocked')
    .gte('occurred_at', periodStart)
    .lt('occurred_at', periodEnd)

  const { data: guardianLinks } = studentIds.length
    ? await supabase.from('parent_student_links').select('parent_id').in('student_id', studentIds).eq('is_active', true)
    : { data: [] as any[] }
  const totalGuardians = new Set((guardianLinks || []).map((g) => g.parent_id)).size
  // Activation approximated as "has ever granted a consent record" — the
  // closest available proxy for "has actually used the app" without a
  // separate login-event table in this build.
  const { data: activeParents } = studentIds.length
    ? await supabase.from('fina_consents').select('guardian_profile_id').in('student_id', studentIds)
    : { data: [] as any[] }
  const activatedGuardianProfileIds = new Set((activeParents || []).map((c) => c.guardian_profile_id))
  const guardianActivationRate = totalGuardians > 0 ? Math.round((activatedGuardianProfileIds.size / totalGuardians) * 100) : 0

  return {
    schoolName: school?.name || '',
    period,
    postCountsByType,
    approvedCount,
    rejectedCount,
    rejectionReasons,
    emergencyCount,
    consentCoverage,
    consentLevelDistribution,
    withdrawalCount: withdrawalCount || 0,
    blockedCount: blockedCount || 0,
    guardianActivationRate,
  }
}

function renderReportHtml(m: ReportMetrics): string {
  const typeRows = Object.entries(m.postCountsByType)
    .map(([type, count]) => `<tr><td>${escapeHtml(type)}</td><td>${count}</td></tr>`)
    .join('')
  const reasonRows = m.rejectionReasons.map((r) => `<li>${escapeHtml(r)}</li>`).join('') || '<li>—</li>'
  const levelRows = Object.entries(m.consentLevelDistribution)
    .map(([level, count]) => `<tr><td>${escapeHtml(level)}</td><td>${count}</td></tr>`)
    .join('')

  return `<!doctype html>
<html dir="ltr" lang="en">
<head>
<meta charset="utf-8" />
<style>
  body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 32px; color: #111; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 15px; margin-top: 24px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
  td, th { border: 1px solid #ddd; padding: 6px 10px; text-align: start; }
  .stat { display: inline-block; margin-inline-end: 24px; margin-top: 8px; }
  .stat b { font-size: 18px; display: block; }
  .stat span { font-size: 11px; color: #666; }
  .attestation { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 12px; font-size: 12px; color: #666; }
</style>
</head>
<body>
  <h1>Al-Fina' — Monthly Compliance Report</h1>
  <div class="meta">${escapeHtml(m.schoolName)} · ${escapeHtml(m.period)}</div>

  <h2>Posts</h2>
  <table><thead><tr><th>Type</th><th>Count</th></tr></thead><tbody>${typeRows || '<tr><td colspan="2">—</td></tr>'}</tbody></table>
  <div class="stat"><b>${m.approvedCount}</b><span>Published</span></div>
  <div class="stat"><b>${m.rejectedCount}</b><span>Rejected</span></div>
  <div class="stat"><b>${m.emergencyCount}</b><span>Emergency</span></div>

  <h2>Rejection Reasons</h2>
  <ul>${reasonRows}</ul>

  <h2>Consent</h2>
  <div class="stat"><b>${m.consentCoverage}%</b><span>Coverage</span></div>
  <div class="stat"><b>${m.withdrawalCount}</b><span>Withdrawals this period</span></div>
  <table><thead><tr><th>Level</th><th>Guardians</th></tr></thead><tbody>${levelRows || '<tr><td colspan="2">—</td></tr>'}</tbody></table>

  <h2>Moderation &amp; Activation</h2>
  <div class="stat"><b>${m.blockedCount}</b><span>Auto-blocked publish attempts</span></div>
  <div class="stat"><b>${m.guardianActivationRate}%</b><span>Guardian activation rate</span></div>

  <div class="attestation">Principal's electronic attestation: pending review — this build generates the report; a signed attestation step is a follow-on workflow, not yet part of this pilot.</div>
</body>
</html>`
}

async function renderPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
    executablePath: process.env.FINA_PUPPETEER_EXECUTABLE_PATH || undefined,
  })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'domcontentloaded' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20px', bottom: '20px' } })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

export async function generateMonthlyReport(schoolId: string, period: string) {
  const metrics = await computeMetrics(schoolId, period)
  const html = renderReportHtml(metrics)
  const pdfBuffer = await renderPdf(html)

  const key = `${schoolId}/reports/${period}.pdf`
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(key, pdfBuffer, { contentType: 'application/pdf', upsert: true })
  if (uploadError) throw new Error(`Failed to upload report: ${uploadError.message}`)

  const { data: report, error } = await supabase
    .from('fina_reports')
    .upsert({ school_id: schoolId, period, kind: 'monthly_compliance', file_key: key, generated_at: new Date().toISOString() }, { onConflict: 'school_id,period,kind' })
    .select()
    .single()
  if (error || !report) throw new Error(`Failed to record report: ${error?.message}`)

  return report
}

export async function listReports(caller: CallerContext, schoolId?: string) {
  // super_admin deliberately excluded — spec §12: compliance reports are
  // PRINCIPAL/SUPERVISOR territory, not SYSADMIN ("operational only").
  if (caller.role !== 'fina_supervisor' && caller.role !== 'admin') throw new Error('Access denied')
  const { listMunicipalitySchoolIds } = await import('./supervisor-access.service')
  let allowedSchoolIds: string[] | 'any' = 'any'
  if (caller.role === 'fina_supervisor') allowedSchoolIds = await listMunicipalitySchoolIds(caller.profileId)
  else if (caller.role === 'admin') allowedSchoolIds = [caller.schoolId]

  let query = supabase.from('fina_reports').select('*').order('period', { ascending: false })
  if (schoolId) {
    if (allowedSchoolIds !== 'any' && !allowedSchoolIds.includes(schoolId)) throw new Error('Access denied')
    query = query.eq('school_id', schoolId)
  } else if (allowedSchoolIds !== 'any') {
    if (allowedSchoolIds.length === 0) return []
    query = query.in('school_id', allowedSchoolIds)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to load reports: ${error.message}`)
  return data || []
}

export async function getReportDownloadUrl(caller: CallerContext, reportId: string): Promise<string> {
  // super_admin deliberately excluded — same reasoning as listReports() above.
  if (caller.role !== 'fina_supervisor' && caller.role !== 'admin') throw new Error('Access denied')

  const { data: report } = await supabase.from('fina_reports').select('*').eq('id', reportId).maybeSingle()
  if (!report || !report.file_key) throw new Error('Report not found')

  if (caller.role === 'admin' && report.school_id !== caller.schoolId) throw new Error('Access denied')
  if (caller.role === 'fina_supervisor') {
    const { listMunicipalitySchoolIds } = await import('./supervisor-access.service')
    const allowed = await listMunicipalitySchoolIds(caller.profileId)
    if (!allowed.includes(report.school_id)) throw new Error('Access denied')
  }

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(report.file_key, 300)
  if (error || !data) throw new Error('Failed to create download link')
  return data.signedUrl
}

async function handleBuildMonthlyReport(payload: Record<string, unknown>): Promise<void> {
  const schoolId = payload.schoolId as string | undefined
  const period = payload.period as string | undefined
  if (!schoolId || !period) throw new Error('build_monthly_report job payload missing schoolId/period')
  await generateMonthlyReport(schoolId, period)
}

registerFinaJobHandler('build_monthly_report', handleBuildMonthlyReport)

/** Enqueues one build_monthly_report job per school for the given period —
 * called by the monthly cron trigger (app.ts) for the previous calendar
 * month, and available for an on-demand admin-triggered regeneration too. */
export async function enqueueMonthlyReportsForAllSchools(period: string): Promise<void> {
  const { data: schools, error } = await supabase.from('schools').select('id')
  if (error) {
    console.error('Failed to list schools for monthly report enqueue:', error)
    return
  }
  for (const school of schools || []) {
    await enqueueFinaJob('build_monthly_report', { schoolId: school.id, period }, 8)
  }
}

function previousPeriod(): string {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Matches the spec's own `0 4 1 * * fina:reports-monthly` — the 1st of
 * each month, reporting on the month that just ended. */
export function startMonthlyReportCron(): void {
  cron.schedule('0 4 1 * *', () => {
    enqueueMonthlyReportsForAllSchools(previousPeriod()).catch((err) => console.error('Failed to enqueue monthly reports:', err))
  })
}
