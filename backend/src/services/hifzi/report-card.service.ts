import puppeteer, { Browser } from 'puppeteer'
import { supabase } from '../../config/supabase'
import { hifziHeatmapService } from './heatmap.service'
import { createHifziMediaSignedUrl, HIFZI_MEDIA_BUCKET } from './signed-url.service'

// ============================================================================
// Report card PDF — mirrors backend/src/services/fina/monthly-report.service.ts
// line-for-line: build an HTML string, headless-Chromium render, upload the
// buffer to the private 'hifzi-media' bucket, return a signed URL.
// ============================================================================

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

interface ReportCardData {
  studentName: string
  schoolName: string
  circleName: string
  generatedAt: string
  attendanceRate: number
  totalSessions: number
  averageScore: number
  bandCounts: Record<string, number>
  recentSessions: { date: string; rangeLabel: string; gradeCode: string; score: number }[]
}

async function computeReportCardData(studentId: string, schoolId: string): Promise<ReportCardData> {
  const { data: studentRow } = await supabase
    .from('students')
    .select('profile:profiles(first_name, last_name), schools(name)')
    .eq('id', studentId)
    .single()

  const { data: enrollment } = await supabase
    .from('hifzi_enrollments')
    .select('hifzi_circles(name_ar)')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .maybeSingle()

  const { data: sessions } = await supabase
    .from('hifzi_sessions')
    .select('created_at, raw_score, grade_code, start_ayah_id, end_ayah_id')
    .eq('student_id', studentId)
    .is('superseded_by_id', null)
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: attendanceRows } = await supabase.from('hifzi_attendance').select('status').eq('student_id', studentId)
  const totalAttendance = attendanceRows?.length ?? 0
  const presentCount = attendanceRows?.filter((r) => r.status === 'present' || r.status === 'late').length ?? 0
  const attendanceRate = totalAttendance > 0 ? (presentCount / totalAttendance) * 100 : 0

  const heatmap = await hifziHeatmapService.getStudentHeatmap(studentId, schoolId)
  const bandCounts: Record<string, number> = {}
  for (const cell of heatmap) bandCounts[cell.band] = (bandCounts[cell.band] ?? 0) + 1

  const scores = (sessions || []).map((s) => Number(s.raw_score ?? 0))
  const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0

  const profile: any = (studentRow as any)?.profile
  const studentName = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : 'الطالب'

  return {
    studentName,
    schoolName: (studentRow as any)?.schools?.name ?? '',
    circleName: (enrollment as any)?.hifzi_circles?.name_ar ?? '—',
    generatedAt: new Date().toLocaleDateString('ar-EG'),
    attendanceRate,
    totalSessions: sessions?.length ?? 0,
    averageScore,
    bandCounts,
    recentSessions: (sessions || []).map((s) => ({
      date: new Date(s.created_at).toLocaleDateString('ar-EG'),
      rangeLabel: `${s.start_ayah_id.slice(0, 8)}…${s.end_ayah_id.slice(0, 8)}`,
      gradeCode: s.grade_code ?? '—',
      score: Number(s.raw_score ?? 0),
    })),
  }
}

function renderReportCardHtml(d: ReportCardData): string {
  const bandRows = Object.entries(d.bandCounts)
    .map(([band, count]) => `<tr><td>${escapeHtml(band)}</td><td>${count}</td></tr>`)
    .join('')
  const sessionRows = d.recentSessions
    .map((s) => `<tr><td>${escapeHtml(s.date)}</td><td>${escapeHtml(s.rangeLabel)}</td><td>${escapeHtml(s.gradeCode)}</td><td>${s.score.toFixed(2)}</td></tr>`)
    .join('')

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8" /><style>
  body { font-family: 'Cairo', Arial, sans-serif; padding: 24px; }
  h1 { color: #022172; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: right; }
  .stat { display: inline-block; margin-inline-end: 24px; }
  .meta { color: #666; font-size: 12px; }
</style></head>
<body>
  <h1>تقرير الخلوة المدرسية — ${escapeHtml(d.studentName)}</h1>
  <div class="meta">${escapeHtml(d.schoolName)} · حلقة ${escapeHtml(d.circleName)} · ${escapeHtml(d.generatedAt)}</div>
  <div>
    <span class="stat">نسبة الحضور: ${d.attendanceRate.toFixed(0)}٪</span>
    <span class="stat">عدد الجلسات: ${d.totalSessions}</span>
    <span class="stat">متوسط الدرجات: ${d.averageScore.toFixed(2)}</span>
  </div>
  <h3>توزيع قوة الحفظ</h3>
  <table><tr><th>المستوى</th><th>عدد الوحدات</th></tr>${bandRows}</table>
  <h3>آخر الجلسات</h3>
  <table><tr><th>التاريخ</th><th>المقطع</th><th>التقدير</th><th>الدرجة</th></tr>${sessionRows}</table>
</body>
</html>`
}

// A cold Chromium launch is hundreds of ms to a few seconds by itself, so a
// single browser process is launched lazily and reused across requests
// instead of launched-and-closed on every PDF — only the (cheap) page is
// per-request. Relaunched automatically if the shared process has died.
let sharedBrowserPromise: Promise<Browser> | null = null

async function getSharedBrowser(): Promise<Browser> {
  if (sharedBrowserPromise) {
    const browser = await sharedBrowserPromise
    if (browser.connected) return browser
    sharedBrowserPromise = null
  }
  sharedBrowserPromise = puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
    executablePath: process.env.HIFZI_PUPPETEER_EXECUTABLE_PATH || process.env.FINA_PUPPETEER_EXECUTABLE_PATH || undefined,
  })
  return sharedBrowserPromise
}

async function renderPdf(html: string): Promise<Buffer> {
  const browser = await getSharedBrowser()
  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20px', bottom: '20px' } })
    return Buffer.from(pdf)
  } finally {
    await page.close()
  }
}

export async function generateReportCard(studentId: string, schoolId: string): Promise<{ storageKey: string; signedUrl: string | null }> {
  const data = await computeReportCardData(studentId, schoolId)
  const html = renderReportCardHtml(data)
  const pdfBuffer = await renderPdf(html)

  const storageKey = `${schoolId}/report-cards/${studentId}-${Date.now()}.pdf`
  const { error: uploadError } = await supabase.storage.from(HIFZI_MEDIA_BUCKET).upload(storageKey, pdfBuffer, { contentType: 'application/pdf', upsert: true })
  if (uploadError) throw new Error(`Failed to upload report card: ${uploadError.message}`)

  const signedUrl = await createHifziMediaSignedUrl(storageKey)
  return { storageKey, signedUrl }
}
