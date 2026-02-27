import { supabase } from '../config/supabase'
import { sendEmail } from './mail'

// ─── Substitution engine ─────────────────────────────────────────────────────

function applySubstitutions(template: string, data: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(data)) {
    result = result.split(`{{${key}}}`).join(value ?? '')
  }
  return result
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmailSendResult {
  success_count: number
  fail_count: number
  total: number
  errors: Array<{ id: string; email: string; name: string; error: string }>
  log_id?: string
}

interface SendOptions {
  subject: string
  body: string
  recipientIds: string[]
  schoolId: string
  sentByProfileId: string
  testEmail?: string
  ccEmails?: string[]
}

// ─── Email log ───────────────────────────────────────────────────────────────

async function logEmail(params: {
  schoolId: string
  sentByProfileId: string
  recipientType: 'student' | 'staff'
  toAddresses: string[]
  subject: string
  body: string
  cc?: string
  successCount: number
  failCount: number
  totalRecipients: number
  errors: any[]
  isTest: boolean
  testEmail?: string
}): Promise<string | undefined> {
  try {
    const { data } = await supabase
      .from('email_log')
      .insert({
        school_id: params.schoolId,
        sent_by_profile_id: params.sentByProfileId,
        recipient_type: params.recipientType,
        to_addresses: params.toAddresses.join(','),
        subject: params.subject,
        body: params.body,
        cc: params.cc || null,
        success_count: params.successCount,
        fail_count: params.failCount,
        total_recipients: params.totalRecipients,
        errors: params.errors,
        is_test: params.isTest,
        test_email: params.testEmail || null,
      })
      .select('id')
      .single()
    return data?.id
  } catch {
    return undefined
  }
}

// ─── Send to Students ────────────────────────────────────────────────────────

export async function sendEmailToStudents(options: SendOptions): Promise<EmailSendResult> {
  const { subject, body, recipientIds, schoolId, sentByProfileId, testEmail, ccEmails } = options

  const { data: students, error } = await supabase
    .from('students')
    .select(`
      id,
      student_number,
      grade_level,
      profile:profiles(
        first_name,
        last_name,
        email
      )
    `)
    .eq('school_id', schoolId)
    .in('id', recipientIds)
    .eq('is_active', true)

  if (error) throw new Error(`Failed to fetch students: ${error.message}`)

  const result: EmailSendResult = {
    success_count: 0,
    fail_count: 0,
    total: students?.length ?? 0,
    errors: [],
  }

  const sentAddresses: string[] = []

  // Process in batches of 5 to respect SMTP rate limits
  const batchSize = 5
  for (let i = 0; i < (students ?? []).length; i += batchSize) {
    const batch = (students ?? []).slice(i, i + batchSize)

    const settled = await Promise.allSettled(
      batch.map(async (student) => {
        const profile = student.profile as any
        if (!profile?.email) throw new Error('No email address')

        const to = testEmail || profile.email
        const subs = {
          full_name: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim(),
          first_name: profile.first_name ?? '',
          last_name: profile.last_name ?? '',
          email: profile.email ?? '',
          student_id: student.student_number ?? '',
          grade: student.grade_level ?? '',
        }

        await sendEmail({
          to,
          subject: applySubstitutions(subject, subs),
          html: applySubstitutions(body, subs),
          text: stripHtml(applySubstitutions(body, subs)),
        })

        return { to, profile }
      })
    )

    settled.forEach((r, idx) => {
      const student = batch[idx]
      const profile = student.profile as any
      if (r.status === 'fulfilled') {
        result.success_count++
        sentAddresses.push(r.value.to)
      } else {
        result.fail_count++
        result.errors.push({
          id: student.id,
          email: testEmail || profile?.email || '',
          name: `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim(),
          error: r.reason?.message ?? 'Send failed',
        })
      }
    })
  }

  // Send CC copy (non-personalised, only in non-test mode)
  if (!testEmail && ccEmails?.length) {
    try {
      await sendEmail({
        to: ccEmails.join(', '),
        subject: `[Copy] ${subject}`,
        html: body,
        text: stripHtml(body),
      })
    } catch { /* CC failure is non-fatal */ }
  }

  // Log
  result.log_id = await logEmail({
    schoolId,
    sentByProfileId,
    recipientType: 'student',
    toAddresses: sentAddresses,
    subject,
    body,
    cc: ccEmails?.join(','),
    successCount: result.success_count,
    failCount: result.fail_count,
    totalRecipients: result.total,
    errors: result.errors,
    isTest: !!testEmail,
    testEmail,
  })

  return result
}

// ─── Send to Staff ───────────────────────────────────────────────────────────

export async function sendEmailToStaff(options: SendOptions): Promise<EmailSendResult> {
  const { subject, body, recipientIds, schoolId, sentByProfileId, testEmail, ccEmails } = options

  const { data: staffList, error } = await supabase
    .from('staff')
    .select(`
      id,
      employee_number,
      profile:profiles!staff_profile_id_fkey(
        first_name,
        last_name,
        email
      )
    `)
    .eq('school_id', schoolId)
    .in('id', recipientIds)
    .eq('is_active', true)

  if (error) throw new Error(`Failed to fetch staff: ${error.message}`)

  const result: EmailSendResult = {
    success_count: 0,
    fail_count: 0,
    total: staffList?.length ?? 0,
    errors: [],
  }

  const sentAddresses: string[] = []

  const batchSize = 5
  for (let i = 0; i < (staffList ?? []).length; i += batchSize) {
    const batch = (staffList ?? []).slice(i, i + batchSize)

    const settled = await Promise.allSettled(
      batch.map(async (staff) => {
        const profile = staff.profile as any
        if (!profile?.email) throw new Error('No email address')

        const to = testEmail || profile.email
        const subs = {
          full_name: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim(),
          first_name: profile.first_name ?? '',
          last_name: profile.last_name ?? '',
          email: profile.email ?? '',
          staff_id: staff.employee_number ?? '',
        }

        await sendEmail({
          to,
          subject: applySubstitutions(subject, subs),
          html: applySubstitutions(body, subs),
          text: stripHtml(applySubstitutions(body, subs)),
        })

        return { to, profile }
      })
    )

    settled.forEach((r, idx) => {
      const staff = batch[idx]
      const profile = staff.profile as any
      if (r.status === 'fulfilled') {
        result.success_count++
        sentAddresses.push(r.value.to)
      } else {
        result.fail_count++
        result.errors.push({
          id: staff.id,
          email: testEmail || profile?.email || '',
          name: `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim(),
          error: r.reason?.message ?? 'Send failed',
        })
      }
    })
  }

  if (!testEmail && ccEmails?.length) {
    try {
      await sendEmail({
        to: ccEmails.join(', '),
        subject: `[Copy] ${subject}`,
        html: body,
        text: stripHtml(body),
      })
    } catch { /* CC failure is non-fatal */ }
  }

  result.log_id = await logEmail({
    schoolId,
    sentByProfileId,
    recipientType: 'staff',
    toAddresses: sentAddresses,
    subject,
    body,
    cc: ccEmails?.join(','),
    successCount: result.success_count,
    failCount: result.fail_count,
    totalRecipients: result.total,
    errors: result.errors,
    isTest: !!testEmail,
    testEmail,
  })

  return result
}

// ─── Email log retrieval ─────────────────────────────────────────────────────

export async function getEmailLog(
  schoolId: string,
  startDate?: string,
  endDate?: string,
  page = 1,
  limit = 50
) {
  let query = supabase
    .from('email_log')
    .select(
      `
        id,
        recipient_type,
        to_addresses,
        subject,
        body,
        cc,
        success_count,
        fail_count,
        total_recipients,
        errors,
        is_test,
        test_email,
        created_at,
        sent_by:profiles!sent_by_profile_id(first_name, last_name)
      `,
      { count: 'exact' }
    )
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })

  if (startDate) query = query.gte('created_at', startDate)
  if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`)

  const from = (page - 1) * limit
  query = query.range(from, from + limit - 1)

  const { data, count, error } = await query
  if (error) throw new Error(error.message)

  return {
    data: data ?? [],
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / limit),
  }
}

// ─── Send Discipline Log ──────────────────────────────────────────────────────

function buildDisciplineLogHtml(
  referrals: any[],
  include: { entryDate: boolean; reporter: boolean; violation: boolean; detention: boolean; suspension: boolean; comments: boolean }
): string {
  if (!referrals.length) return '<p><em>No referrals found.</em></p>'

  let html = `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px;">
    <thead style="background:#f3f4f6;">
      <tr>`
  if (include.entryDate) html += '<th>Date</th>'
  if (include.reporter) html += '<th>Reporter</th>'
  if (include.violation) html += '<th>Violation</th>'
  if (include.detention) html += '<th>Detention</th>'
  if (include.suspension) html += '<th>Suspension</th>'
  if (include.comments) html += '<th>Comments</th>'
  html += '</tr></thead><tbody>'

  for (const r of referrals) {
    const fv = r.field_values || {}
    html += '<tr>'
    if (include.entryDate) html += `<td>${r.incident_date || '—'}</td>`
    if (include.reporter) {
      const rep = r.reporter?.profile
      html += `<td>${rep ? `${rep.first_name || ''} ${rep.last_name || ''}`.trim() : '—'}</td>`
    }
    if (include.violation) html += `<td>${Object.values(fv).find((v: any) => Array.isArray(v) ? v.join(', ') : v) || '—'}</td>`
    if (include.detention) html += `<td>${fv['detention'] || '—'}</td>`
    if (include.suspension) html += `<td>${fv['suspension'] || '—'}</td>`
    if (include.comments) html += `<td>${fv['comments'] || '—'}</td>`
    html += '</tr>'
  }

  html += '</tbody></table>'
  return html
}

export async function sendDisciplineLog(options: {
  subject: string
  body: string
  recipientIds: string[]
  schoolId: string
  sentByProfileId: string
  testEmail?: string
  includeFields: { entryDate: boolean; reporter: boolean; violation: boolean; detention: boolean; suspension: boolean; comments: boolean }
  academicYearId?: string
}): Promise<EmailSendResult> {
  const { subject, body, recipientIds, schoolId, sentByProfileId, testEmail, includeFields, academicYearId } = options

  // Fetch students with profiles
  const { data: students, error: sErr } = await supabase
    .from('students')
    .select('id, student_number, grade_level, profile:profiles(first_name, last_name, email)')
    .eq('school_id', schoolId)
    .in('id', recipientIds)
    .eq('is_active', true)
  if (sErr) throw new Error(`Failed to fetch students: ${sErr.message}`)

  // Fetch all referrals for selected students in batch
  let refQuery = supabase
    .from('discipline_referrals')
    .select(`id, student_id, incident_date, field_values, reporter:staff!reporter_id(profile:profiles!staff_profile_id_fkey(first_name, last_name))`)
    .eq('school_id', schoolId)
    .in('student_id', recipientIds)
    .order('incident_date', { ascending: false })
  if (academicYearId) refQuery = refQuery.eq('academic_year_id', academicYearId)
  const { data: allReferrals } = await refQuery

  // Build a map: student_id → referrals[]
  const refMap = new Map<string, any[]>()
  for (const r of allReferrals || []) {
    if (!refMap.has(r.student_id)) refMap.set(r.student_id, [])
    refMap.get(r.student_id)!.push(r)
  }

  const result: EmailSendResult = { success_count: 0, fail_count: 0, total: students?.length ?? 0, errors: [] }
  const sentAddresses: string[] = []

  const batchSize = 5
  for (let i = 0; i < (students ?? []).length; i += batchSize) {
    const batch = (students ?? []).slice(i, i + batchSize)
    const settled = await Promise.allSettled(
      batch.map(async (student) => {
        const profile = student.profile as any
        if (!profile?.email) throw new Error('No email address')
        const to = testEmail || profile.email
        const referrals = refMap.get(student.id) || []
        const subs = {
          full_name: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim(),
          first_name: profile.first_name ?? '',
          last_name: profile.last_name ?? '',
          email: profile.email ?? '',
          grade: student.grade_level ?? '',
          referral_count: String(referrals.length),
          discipline_log: buildDisciplineLogHtml(referrals, includeFields),
        }
        await sendEmail({
          to,
          subject: applySubstitutions(subject, subs),
          html: applySubstitutions(body, subs),
          text: stripHtml(applySubstitutions(body, subs)),
        })
        return { to }
      })
    )
    settled.forEach((r, idx) => {
      const student = batch[idx]
      const profile = student.profile as any
      if (r.status === 'fulfilled') { result.success_count++; sentAddresses.push(r.value.to) }
      else { result.fail_count++; result.errors.push({ id: student.id, email: testEmail || profile?.email || '', name: `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim(), error: r.reason?.message ?? 'Send failed' }) }
    })
  }

  result.log_id = await logEmail({ schoolId, sentByProfileId, recipientType: 'student', toAddresses: sentAddresses, subject, body, successCount: result.success_count, failCount: result.fail_count, totalRecipients: result.total, errors: result.errors, isTest: !!testEmail, testEmail })
  return result
}

// ─── Send Report Cards ────────────────────────────────────────────────────────

function buildReportCardHtml(
  grades: any[],
  include: { teacher: boolean; comments: boolean; percents: boolean; credits: boolean }
): string {
  if (!grades.length) return '<p><em>No grades found.</em></p>'

  let html = `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px;">
    <thead style="background:#f3f4f6;">
      <tr><th>Subject</th><th>Grade</th>`
  if (include.percents) html += '<th>%</th>'
  if (include.credits) html += '<th>Credits</th>'
  if (include.teacher) html += '<th>Teacher</th>'
  if (include.comments) html += '<th>Comments</th>'
  html += '</tr></thead><tbody>'

  for (const g of grades) {
    const cp = g.course_period as any
    const subject = cp?.course?.subject?.name || cp?.course?.title || cp?.title || '—'
    const letter = g.letter_grade || '—'
    html += `<tr><td>${subject}</td><td><strong>${letter}</strong></td>`
    if (include.percents) html += `<td>${g.percent_grade != null ? `${parseFloat(g.percent_grade).toFixed(1)}%` : '—'}</td>`
    if (include.credits) html += `<td>${cp?.course?.credit_hours ?? '—'}</td>`
    if (include.teacher) {
      const tid = cp?.teacher_id
      html += `<td>${tid ? '—' : '—'}</td>` // teacher name not in this query
    }
    if (include.comments) html += `<td>${g.comments || '—'}</td>`
    html += '</tr>'
  }

  html += '</tbody></table>'
  return html
}

export async function sendReportCards(options: {
  subject: string
  body: string
  recipientIds: string[]
  schoolId: string
  sentByProfileId: string
  testEmail?: string
  markingPeriodId?: string
  academicYearId?: string
  includeFields: { teacher: boolean; comments: boolean; percents: boolean; credits: boolean }
}): Promise<EmailSendResult> {
  const { subject, body, recipientIds, schoolId, sentByProfileId, testEmail, markingPeriodId, academicYearId, includeFields } = options

  const { data: students, error: sErr } = await supabase
    .from('students')
    .select('id, student_number, grade_level, profile:profiles(first_name, last_name, email)')
    .eq('school_id', schoolId)
    .in('id', recipientIds)
    .eq('is_active', true)
  if (sErr) throw new Error(`Failed to fetch students: ${sErr.message}`)

  // Fetch all final grades for selected students in one query
  let gradesQuery = supabase
    .from('student_final_grades')
    .select(`*, course_period:course_periods(id, title, course:courses(id, title, credit_hours, subject:subjects(name, code)), teacher_id), marking_period:marking_periods(id, title)`)
    .in('student_id', recipientIds)
  if (academicYearId) gradesQuery = gradesQuery.eq('academic_year_id', academicYearId)
  if (markingPeriodId) gradesQuery = gradesQuery.eq('marking_period_id', markingPeriodId)
  const { data: allGrades } = await gradesQuery

  const gradesMap = new Map<string, any[]>()
  for (const g of allGrades || []) {
    if (!gradesMap.has(g.student_id)) gradesMap.set(g.student_id, [])
    gradesMap.get(g.student_id)!.push(g)
  }

  const result: EmailSendResult = { success_count: 0, fail_count: 0, total: students?.length ?? 0, errors: [] }
  const sentAddresses: string[] = []

  const batchSize = 5
  for (let i = 0; i < (students ?? []).length; i += batchSize) {
    const batch = (students ?? []).slice(i, i + batchSize)
    const settled = await Promise.allSettled(
      batch.map(async (student) => {
        const profile = student.profile as any
        if (!profile?.email) throw new Error('No email address')
        const to = testEmail || profile.email
        const grades = gradesMap.get(student.id) || []
        const subs = {
          full_name: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim(),
          first_name: profile.first_name ?? '',
          last_name: profile.last_name ?? '',
          email: profile.email ?? '',
          grade: student.grade_level ?? '',
          student_id: student.student_number ?? '',
          report_card: buildReportCardHtml(grades, includeFields),
        }
        await sendEmail({ to, subject: applySubstitutions(subject, subs), html: applySubstitutions(body, subs), text: stripHtml(applySubstitutions(body, subs)) })
        return { to }
      })
    )
    settled.forEach((r, idx) => {
      const student = batch[idx]
      const profile = student.profile as any
      if (r.status === 'fulfilled') { result.success_count++; sentAddresses.push(r.value.to) }
      else { result.fail_count++; result.errors.push({ id: student.id, email: testEmail || profile?.email || '', name: `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim(), error: r.reason?.message ?? 'Send failed' }) }
    })
  }

  result.log_id = await logEmail({ schoolId, sentByProfileId, recipientType: 'student', toAddresses: sentAddresses, subject, body, successCount: result.success_count, failCount: result.fail_count, totalRecipients: result.total, errors: result.errors, isTest: !!testEmail, testEmail })
  return result
}

// ─── Send Balances ────────────────────────────────────────────────────────────

export async function sendBalances(options: {
  subject: string
  body: string
  recipientIds: string[]
  schoolId: string
  sentByProfileId: string
  testEmail?: string
  academicYear?: string
}): Promise<EmailSendResult> {
  const { subject, body, recipientIds, schoolId, sentByProfileId, testEmail, academicYear } = options

  const { data: students, error: sErr } = await supabase
    .from('students')
    .select('id, student_number, grade_level, profile:profiles(first_name, last_name, email)')
    .eq('school_id', schoolId)
    .in('id', recipientIds)
    .eq('is_active', true)
  if (sErr) throw new Error(`Failed to fetch students: ${sErr.message}`)

  // Fetch fees for all selected students
  let feesQuery = supabase
    .from('student_fees')
    .select('student_id, final_amount, amount_paid, balance, status, due_date, fee_structures(fee_categories(name))')
    .eq('school_id', schoolId)
    .in('student_id', recipientIds)
  if (academicYear) feesQuery = feesQuery.eq('academic_year', academicYear)
  const { data: allFees } = await feesQuery

  const feesMap = new Map<string, any[]>()
  for (const f of allFees || []) {
    if (!feesMap.has(f.student_id)) feesMap.set(f.student_id, [])
    feesMap.get(f.student_id)!.push(f)
  }

  const result: EmailSendResult = { success_count: 0, fail_count: 0, total: students?.length ?? 0, errors: [] }
  const sentAddresses: string[] = []

  const batchSize = 5
  for (let i = 0; i < (students ?? []).length; i += batchSize) {
    const batch = (students ?? []).slice(i, i + batchSize)
    const settled = await Promise.allSettled(
      batch.map(async (student) => {
        const profile = student.profile as any
        if (!profile?.email) throw new Error('No email address')
        const to = testEmail || profile.email
        const fees = feesMap.get(student.id) || []
        const totalBalance = fees.reduce((sum, f) => sum + (parseFloat(f.balance) || 0), 0)
        const feesListHtml = fees.length
          ? `<table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;font-size:14px;"><thead style="background:#f3f4f6;"><tr><th>Fee</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Due Date</th></tr></thead><tbody>` +
            fees.map(f => `<tr><td>${(f.fee_structures as any)?.fee_categories?.name || 'Fee'}</td><td>${parseFloat(f.final_amount).toFixed(2)}</td><td>${parseFloat(f.amount_paid).toFixed(2)}</td><td>${parseFloat(f.balance).toFixed(2)}</td><td>${f.due_date || '—'}</td></tr>`).join('') +
            `</tbody></table>`
          : '<p><em>No fees found.</em></p>'
        const subs = {
          full_name: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim(),
          first_name: profile.first_name ?? '',
          last_name: profile.last_name ?? '',
          email: profile.email ?? '',
          grade: student.grade_level ?? '',
          student_id: student.student_number ?? '',
          balance: totalBalance.toFixed(2),
          fees_list: feesListHtml,
        }
        await sendEmail({ to, subject: applySubstitutions(subject, subs), html: applySubstitutions(body, subs), text: stripHtml(applySubstitutions(body, subs)) })
        return { to }
      })
    )
    settled.forEach((r, idx) => {
      const student = batch[idx]
      const profile = student.profile as any
      if (r.status === 'fulfilled') { result.success_count++; sentAddresses.push(r.value.to) }
      else { result.fail_count++; result.errors.push({ id: student.id, email: testEmail || profile?.email || '', name: `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim(), error: r.reason?.message ?? 'Send failed' }) }
    })
  }

  result.log_id = await logEmail({ schoolId, sentByProfileId, recipientType: 'student', toAddresses: sentAddresses, subject, body, successCount: result.success_count, failCount: result.fail_count, totalRecipients: result.total, errors: result.errors, isTest: !!testEmail, testEmail })
  return result
}

// ─── Notification Settings ────────────────────────────────────────────────────

export interface NotificationSettings {
  absences?: {
    is_active: boolean
    attendance_code?: string
    threshold_count?: number
    period?: 'school_year' | 'semester' | 'quarter' | 'month' | 'week' | 'day'
    subject?: string
    body?: string
    reply_to?: string
    copy_to?: string
    test_email?: string
  }
  birthday?: {
    is_active: boolean
    subject?: string
    body?: string
    reply_to?: string
    copy_to?: string
    test_email?: string
  }
  payments?: {
    is_active: boolean
    days_after_due?: number
    days_before_due?: number
    subject?: string
    body?: string
    reply_to?: string
    copy_to?: string
    test_email?: string
  }
}

export async function getNotificationSettings(schoolId: string, campusId?: string): Promise<NotificationSettings> {
  let query = supabase
    .from('email_notification_settings')
    .select('notification_type, settings, is_active')
    .eq('school_id', schoolId)

  if (campusId) {
    query = query.eq('campus_id', campusId)
  } else {
    query = query.is('campus_id', null)
  }

  const { data } = await query
  const result: NotificationSettings = {}
  for (const row of data || []) {
    const type = row.notification_type as keyof NotificationSettings
    result[type] = { is_active: row.is_active, ...(row.settings || {}) }
  }
  return result
}

export async function saveNotificationSettings(
  schoolId: string,
  type: 'absences' | 'birthday' | 'payments',
  settings: Record<string, any>,
  campusId?: string
): Promise<void> {
  const { is_active, ...rest } = settings
  const { error } = await supabase
    .from('email_notification_settings')
    .upsert(
      {
        school_id: schoolId,
        campus_id: campusId || null,
        notification_type: type,
        is_active: is_active ?? false,
        settings: rest,
      },
      { onConflict: 'school_id,campus_id,notification_type' }
    )
  if (error) throw new Error(error.message)
}

// ─── Parent email helpers ─────────────────────────────────────────────────────

/**
 * For a set of student IDs, return a map: studentId → parent { id, name, email }[]
 */
async function lookupParentsForStudents(studentIds: string[]): Promise<Map<string, Array<{ parentId: string; name: string; email: string }>>> {
  if (!studentIds.length) return new Map()

  const { data: links } = await supabase
    .from('parent_student_links')
    .select(`
      student_id,
      parent:parents(
        id,
        profile:profiles(first_name, last_name, email)
      )
    `)
    .in('student_id', studentIds)
    .eq('is_active', true)

  const map = new Map<string, Array<{ parentId: string; name: string; email: string }>>()
  for (const link of links || []) {
    const p = link.parent as any
    if (!p?.profile?.email) continue
    const entry = {
      parentId: p.id,
      name: `${p.profile.first_name ?? ''} ${p.profile.last_name ?? ''}`.trim(),
      email: p.profile.email as string,
    }
    if (!map.has(link.student_id)) map.set(link.student_id, [])
    map.get(link.student_id)!.push(entry)
  }
  return map
}

// ─── Send Days Absent to Parents ──────────────────────────────────────────────

export async function sendDaysAbsent(options: {
  subject: string
  body: string
  recipientStudentIds: string[]
  schoolId: string
  sentByProfileId: string
  testEmail?: string
  startDate: string
  endDate: string
}): Promise<EmailSendResult> {
  const { subject, body, recipientStudentIds, schoolId, sentByProfileId, testEmail, startDate, endDate } = options

  // Fetch students
  const { data: students, error: sErr } = await supabase
    .from('students')
    .select('id, student_number, grade_level, profile:profiles(first_name, last_name, email)')
    .eq('school_id', schoolId)
    .in('id', recipientStudentIds)
    .eq('is_active', true)
  if (sErr) throw new Error(`Failed to fetch students: ${sErr.message}`)

  // Fetch absence counts per student for the date range
  const { data: absenceRows } = await supabase
    .from('student_attendance')
    .select('student_id, attendance_date, attendance_code:attendance_codes(code_name, is_absent)')
    .eq('school_id', schoolId)
    .in('student_id', recipientStudentIds)
    .gte('attendance_date', startDate)
    .lte('attendance_date', endDate)

  // Build absence list per student
  const absenceMap = new Map<string, string[]>()
  for (const row of absenceRows || []) {
    const code = row.attendance_code as any
    if (!code?.is_absent) continue
    if (!absenceMap.has(row.student_id)) absenceMap.set(row.student_id, [])
    absenceMap.get(row.student_id)!.push(`${row.attendance_date} (${code.code_name || 'Absent'})`)
  }

  // Look up parents
  const parentMap = await lookupParentsForStudents(recipientStudentIds)

  const result: EmailSendResult = { success_count: 0, fail_count: 0, total: 0, errors: [] }
  const sentAddresses: string[] = []

  // Deduplicate: one email per parent (they may have multiple children selected)
  const parentEmailsSent = new Set<string>()

  const batchSize = 5
  const allTasks: Array<() => Promise<void>> = []

  for (const student of students || []) {
    const profile = student.profile as any
    const parents = parentMap.get(student.id) || []
    const daysAbsentList = absenceMap.get(student.id) || []
    const studentName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim()

    for (const parent of parents) {
      result.total++
      allTasks.push(async () => {
        const to = testEmail || parent.email
        if (!testEmail && parentEmailsSent.has(parent.email)) return // already sent in non-test mode
        const subs = {
          parent_name: parent.name,
          full_name: studentName,
          first_name: profile?.first_name ?? '',
          last_name: profile?.last_name ?? '',
          student_id: student.student_number ?? '',
          grade: student.grade_level ?? '',
          days_absent: String(daysAbsentList.length),
          start_date: startDate,
          end_date: endDate,
          days_absent_list: daysAbsentList.length
            ? `<ul>${daysAbsentList.map((d) => `<li>${d}</li>`).join('')}</ul>`
            : '<p>No absences recorded.</p>',
        }
        await sendEmail({
          to,
          subject: applySubstitutions(subject, subs),
          html: applySubstitutions(body, subs),
          text: stripHtml(applySubstitutions(body, subs)),
        })
        parentEmailsSent.add(parent.email)
        result.success_count++
        sentAddresses.push(to)
      })
    }
  }

  // Run in batches of 5
  for (let i = 0; i < allTasks.length; i += batchSize) {
    const batch = allTasks.slice(i, i + batchSize)
    const settled = await Promise.allSettled(batch.map((fn) => fn()))
    settled.forEach((r) => {
      if (r.status === 'rejected') {
        result.fail_count++
        result.success_count = Math.max(0, result.success_count - 1)
        result.errors.push({ id: '', email: '', name: '', error: r.reason?.message ?? 'Send failed' })
      }
    })
  }

  result.log_id = await logEmail({ schoolId, sentByProfileId, recipientType: 'student', toAddresses: sentAddresses, subject, body, successCount: result.success_count, failCount: result.fail_count, totalRecipients: result.total, errors: result.errors, isTest: !!testEmail, testEmail })
  return result
}

// ─── Send Discipline Log to Parents ──────────────────────────────────────────

export async function sendDisciplineLogToParents(options: {
  subject: string
  body: string
  recipientIds: string[]
  schoolId: string
  sentByProfileId: string
  testEmail?: string
  includeFields: { entryDate: boolean; reporter: boolean; violation: boolean; detention: boolean; suspension: boolean; comments: boolean }
  academicYearId?: string
}): Promise<EmailSendResult> {
  const { subject, body, recipientIds, schoolId, sentByProfileId, testEmail, includeFields, academicYearId } = options

  const { data: students, error: sErr } = await supabase
    .from('students')
    .select('id, student_number, grade_level, profile:profiles(first_name, last_name)')
    .eq('school_id', schoolId).in('id', recipientIds).eq('is_active', true)
  if (sErr) throw new Error(`Failed to fetch students: ${sErr.message}`)

  let refQuery = supabase
    .from('discipline_referrals')
    .select('id, student_id, incident_date, field_values, reporter:staff!reporter_id(profile:profiles!staff_profile_id_fkey(first_name, last_name))')
    .eq('school_id', schoolId).in('student_id', recipientIds).order('incident_date', { ascending: false })
  if (academicYearId) refQuery = refQuery.eq('academic_year_id', academicYearId)
  const { data: allReferrals } = await refQuery
  const refMap = new Map<string, any[]>()
  for (const r of allReferrals || []) {
    if (!refMap.has(r.student_id)) refMap.set(r.student_id, [])
    refMap.get(r.student_id)!.push(r)
  }

  const parentMap = await lookupParentsForStudents(recipientIds)
  const result: EmailSendResult = { success_count: 0, fail_count: 0, total: 0, errors: [] }
  const sentAddresses: string[] = []
  const parentEmailsSent = new Set<string>()
  const batchSize = 5
  const allTasks: Array<() => Promise<void>> = []

  for (const student of students || []) {
    const profile = student.profile as any
    const parents = parentMap.get(student.id) || []
    const referrals = refMap.get(student.id) || []
    const studentName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim()
    for (const parent of parents) {
      result.total++
      allTasks.push(async () => {
        const to = testEmail || parent.email
        if (!testEmail && parentEmailsSent.has(parent.email)) return
        const subs = {
          parent_name: parent.name,
          full_name: studentName,
          first_name: profile?.first_name ?? '',
          last_name: profile?.last_name ?? '',
          student_id: student.student_number ?? '',
          grade: student.grade_level ?? '',
          referral_count: String(referrals.length),
          discipline_log: buildDisciplineLogHtml(referrals, includeFields),
        }
        await sendEmail({ to, subject: applySubstitutions(subject, subs), html: applySubstitutions(body, subs), text: stripHtml(applySubstitutions(body, subs)) })
        parentEmailsSent.add(parent.email)
        result.success_count++
        sentAddresses.push(to)
      })
    }
  }
  for (let i = 0; i < allTasks.length; i += batchSize) {
    const settled = await Promise.allSettled(allTasks.slice(i, i + batchSize).map((fn) => fn()))
    settled.forEach((r) => { if (r.status === 'rejected') { result.fail_count++; result.success_count = Math.max(0, result.success_count - 1) } })
  }
  result.log_id = await logEmail({ schoolId, sentByProfileId, recipientType: 'student', toAddresses: sentAddresses, subject, body, successCount: result.success_count, failCount: result.fail_count, totalRecipients: result.total, errors: result.errors, isTest: !!testEmail, testEmail })
  return result
}

// ─── Send Report Cards to Parents ────────────────────────────────────────────

export async function sendReportCardsToParents(options: {
  subject: string
  body: string
  recipientIds: string[]
  schoolId: string
  sentByProfileId: string
  testEmail?: string
  markingPeriodId?: string
  academicYearId?: string
  includeFields: { teacher: boolean; comments: boolean; percents: boolean; credits: boolean }
}): Promise<EmailSendResult> {
  const { subject, body, recipientIds, schoolId, sentByProfileId, testEmail, markingPeriodId, academicYearId, includeFields } = options

  const { data: students, error: sErr } = await supabase
    .from('students')
    .select('id, student_number, grade_level, profile:profiles(first_name, last_name)')
    .eq('school_id', schoolId).in('id', recipientIds).eq('is_active', true)
  if (sErr) throw new Error(`Failed to fetch students: ${sErr.message}`)

  let gradesQuery = supabase.from('student_final_grades')
    .select('*, course_period:course_periods(id, title, course:courses(id, title, credit_hours, subject:subjects(name, code)), teacher_id), marking_period:marking_periods(id, title)')
    .in('student_id', recipientIds)
  if (academicYearId) gradesQuery = gradesQuery.eq('academic_year_id', academicYearId)
  if (markingPeriodId) gradesQuery = gradesQuery.eq('marking_period_id', markingPeriodId)
  const { data: allGrades } = await gradesQuery
  const gradesMap = new Map<string, any[]>()
  for (const g of allGrades || []) {
    if (!gradesMap.has(g.student_id)) gradesMap.set(g.student_id, [])
    gradesMap.get(g.student_id)!.push(g)
  }

  const parentMap = await lookupParentsForStudents(recipientIds)
  const result: EmailSendResult = { success_count: 0, fail_count: 0, total: 0, errors: [] }
  const sentAddresses: string[] = []
  const parentEmailsSent = new Set<string>()
  const batchSize = 5
  const allTasks: Array<() => Promise<void>> = []

  for (const student of students || []) {
    const profile = student.profile as any
    const parents = parentMap.get(student.id) || []
    const grades = gradesMap.get(student.id) || []
    const studentName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim()
    for (const parent of parents) {
      result.total++
      allTasks.push(async () => {
        const to = testEmail || parent.email
        if (!testEmail && parentEmailsSent.has(parent.email)) return
        const subs = {
          parent_name: parent.name,
          full_name: studentName,
          first_name: profile?.first_name ?? '',
          last_name: profile?.last_name ?? '',
          student_id: student.student_number ?? '',
          grade: student.grade_level ?? '',
          report_card: buildReportCardHtml(grades, includeFields),
        }
        await sendEmail({ to, subject: applySubstitutions(subject, subs), html: applySubstitutions(body, subs), text: stripHtml(applySubstitutions(body, subs)) })
        parentEmailsSent.add(parent.email)
        result.success_count++
        sentAddresses.push(to)
      })
    }
  }
  for (let i = 0; i < allTasks.length; i += batchSize) {
    const settled = await Promise.allSettled(allTasks.slice(i, i + batchSize).map((fn) => fn()))
    settled.forEach((r) => { if (r.status === 'rejected') { result.fail_count++; result.success_count = Math.max(0, result.success_count - 1) } })
  }
  result.log_id = await logEmail({ schoolId, sentByProfileId, recipientType: 'student', toAddresses: sentAddresses, subject, body, successCount: result.success_count, failCount: result.fail_count, totalRecipients: result.total, errors: result.errors, isTest: !!testEmail, testEmail })
  return result
}

// ─── Send Balances to Parents ─────────────────────────────────────────────────

export async function sendBalancesToParents(options: {
  subject: string
  body: string
  recipientIds: string[]
  schoolId: string
  sentByProfileId: string
  testEmail?: string
  academicYear?: string
}): Promise<EmailSendResult> {
  const { subject, body, recipientIds, schoolId, sentByProfileId, testEmail, academicYear } = options

  const { data: students, error: sErr } = await supabase
    .from('students')
    .select('id, student_number, grade_level, profile:profiles(first_name, last_name)')
    .eq('school_id', schoolId).in('id', recipientIds).eq('is_active', true)
  if (sErr) throw new Error(`Failed to fetch students: ${sErr.message}`)

  let feesQuery = supabase.from('student_fees')
    .select('student_id, final_amount, amount_paid, balance, status, due_date, fee_structures(fee_categories(name))')
    .eq('school_id', schoolId).in('student_id', recipientIds)
  if (academicYear) feesQuery = feesQuery.eq('academic_year', academicYear)
  const { data: allFees } = await feesQuery
  const feesMap = new Map<string, any[]>()
  for (const f of allFees || []) {
    if (!feesMap.has(f.student_id)) feesMap.set(f.student_id, [])
    feesMap.get(f.student_id)!.push(f)
  }

  const parentMap = await lookupParentsForStudents(recipientIds)
  const result: EmailSendResult = { success_count: 0, fail_count: 0, total: 0, errors: [] }
  const sentAddresses: string[] = []
  const parentEmailsSent = new Set<string>()
  const batchSize = 5
  const allTasks: Array<() => Promise<void>> = []

  for (const student of students || []) {
    const profile = student.profile as any
    const parents = parentMap.get(student.id) || []
    const fees = feesMap.get(student.id) || []
    const totalBalance = fees.reduce((sum, f) => sum + (parseFloat(f.balance) || 0), 0)
    const feesListHtml = fees.length
      ? `<table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;font-size:14px;"><thead style="background:#f3f4f6;"><tr><th>Fee</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Due Date</th></tr></thead><tbody>` +
        fees.map(f => `<tr><td>${(f.fee_structures as any)?.fee_categories?.name || 'Fee'}</td><td>${parseFloat(f.final_amount).toFixed(2)}</td><td>${parseFloat(f.amount_paid).toFixed(2)}</td><td>${parseFloat(f.balance).toFixed(2)}</td><td>${f.due_date || '—'}</td></tr>`).join('') +
        `</tbody></table>`
      : '<p><em>No fees found.</em></p>'
    const studentName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim()

    for (const parent of parents) {
      result.total++
      allTasks.push(async () => {
        const to = testEmail || parent.email
        if (!testEmail && parentEmailsSent.has(parent.email)) return
        const subs = {
          parent_name: parent.name,
          full_name: studentName,
          first_name: profile?.first_name ?? '',
          last_name: profile?.last_name ?? '',
          student_id: student.student_number ?? '',
          grade: student.grade_level ?? '',
          balance: totalBalance.toFixed(2),
          fees_list: feesListHtml,
        }
        await sendEmail({ to, subject: applySubstitutions(subject, subs), html: applySubstitutions(body, subs), text: stripHtml(applySubstitutions(body, subs)) })
        parentEmailsSent.add(parent.email)
        result.success_count++
        sentAddresses.push(to)
      })
    }
  }
  for (let i = 0; i < allTasks.length; i += batchSize) {
    const settled = await Promise.allSettled(allTasks.slice(i, i + batchSize).map((fn) => fn()))
    settled.forEach((r) => { if (r.status === 'rejected') { result.fail_count++; result.success_count = Math.max(0, result.success_count - 1) } })
  }
  result.log_id = await logEmail({ schoolId, sentByProfileId, recipientType: 'student', toAddresses: sentAddresses, subject, body, successCount: result.success_count, failCount: result.fail_count, totalRecipients: result.total, errors: result.errors, isTest: !!testEmail, testEmail })
  return result
}
