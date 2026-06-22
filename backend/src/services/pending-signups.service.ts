import { supabase } from '../config/supabase'
import { decryptPassword } from './public-signup.service'
import { sendEmail } from './mail'
import { getSchoolMailer } from './email.service'
import { generateCredentials } from './username.service'
import bcrypt from 'bcrypt'

export interface PendingSignup {
  id: string
  school_id: string
  campus_id: string | null
  signup_link_id: string | null
  role: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  // password_hash is never returned to callers — stripped before returning
  extra_data: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
  // joined
  link_label?: string | null
  reviewer_name?: string | null
  campus_name?: string | null
}

export interface CreatePendingSignupDTO {
  schoolId: string
  campusId: string | null
  signupLinkId: string
  role: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  encryptedPassword: string
  extraData: Record<string, unknown>
}

export interface PendingSignupsFilter {
  status?: string
  role?: string
  campusId?: string
  search?: string
  page?: number
  limit?: number
}

function stripPasswordHash<T extends Record<string, any>>(row: T): Omit<T, 'password_hash'> {
  const { password_hash: _ph, ...safe } = row
  return safe
}

export async function createPendingSignup(dto: CreatePendingSignupDTO): Promise<PendingSignup> {
  const { data, error } = await supabase
    .from('pending_signups')
    .insert({
      school_id: dto.schoolId,
      campus_id: dto.campusId,
      signup_link_id: dto.signupLinkId,
      role: dto.role,
      first_name: dto.firstName,
      last_name: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      password_hash: dto.encryptedPassword,
      extra_data: dto.extraData,
    })
    .select()
    .single()

  if (error) throw error

  // Increment use_count on the signup link (read-then-write; atomic enough for low-volume signups)
  try {
    const { data: link } = await supabase
      .from('signup_links')
      .select('use_count')
      .eq('id', dto.signupLinkId)
      .single()

    if (link) {
      await supabase
        .from('signup_links')
        .update({ use_count: (link.use_count ?? 0) + 1 })
        .eq('id', dto.signupLinkId)
    }
  } catch { /* silently ignore */ }

  // Notify school admin via email (non-blocking — never breaks signup creation)
  notifyAdminOfNewSignup(dto.schoolId, dto.firstName, dto.lastName, dto.email, dto.role).catch(() => {})

  return stripPasswordHash(data) as PendingSignup
}

export async function getPendingSignups(
  schoolId: string,
  filters: PendingSignupsFilter = {}
): Promise<{ data: PendingSignup[]; total: number }> {
  const page = Math.max(1, filters.page ?? 1)
  const limit = Math.min(100, filters.limit ?? 20)
  const offset = (page - 1) * limit

  let query = supabase
    .from('pending_signups')
    .select(`
      id, school_id, campus_id, signup_link_id, role, first_name, last_name,
      email, phone, extra_data, status, reviewed_by, reviewed_at, rejection_reason,
      created_at, updated_at,
      link:signup_link_id ( label ),
      reviewer:reviewed_by ( first_name, last_name ),
      campus:campus_id ( name )
    `, { count: 'exact' })
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.role) query = query.eq('role', filters.role)
  if (filters.campusId) query = query.eq('campus_id', filters.campusId)
  if (filters.search) {
    query = query.or(
      `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
    )
  }

  const { data, error, count } = await query
  if (error) throw error

  const rows = (data || []).map((row: any) => ({
    ...row,
    link_label: row.link?.label ?? null,
    reviewer_name: row.reviewer
      ? `${row.reviewer.first_name ?? ''} ${row.reviewer.last_name ?? ''}`.trim()
      : null,
    campus_name: row.campus?.name ?? null,
    link: undefined,
    reviewer: undefined,
    campus: undefined,
    password_hash: undefined,
  })) as PendingSignup[]

  return { data: rows, total: count ?? 0 }
}

export async function getPendingSignupById(id: string, schoolId: string): Promise<PendingSignup | null> {
  const { data, error } = await supabase
    .from('pending_signups')
    .select(`
      id, school_id, campus_id, signup_link_id, role, first_name, last_name,
      email, phone, extra_data, status, reviewed_by, reviewed_at, rejection_reason,
      created_at, updated_at,
      link:signup_link_id ( label, token, role ),
      reviewer:reviewed_by ( first_name, last_name ),
      campus:campus_id ( name )
    `)
    .eq('id', id)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    ...(data as any),
    link_label: (data as any).link?.label ?? null,
    reviewer_name: (data as any).reviewer
      ? `${(data as any).reviewer.first_name ?? ''} ${(data as any).reviewer.last_name ?? ''}`.trim()
      : null,
    campus_name: (data as any).campus?.name ?? null,
    link: undefined,
    reviewer: undefined,
    campus: undefined,
    password_hash: undefined,
  } as PendingSignup
}

export async function approvePendingSignup(
  id: string,
  schoolId: string,
  reviewedBy: string
): Promise<{ profile: Record<string, unknown>; pendingSignup: PendingSignup; plainPassword?: string }> {
  // Fetch the row WITH password_hash for account creation
  const { data: row, error: fetchError } = await supabase
    .from('pending_signups')
    .select('*')
    .eq('id', id)
    .eq('school_id', schoolId)
    .eq('status', 'pending')
    .single()

  if (fetchError || !row) throw new Error('Pending signup not found or already reviewed')

  // Decrypt password
  const password = decryptPassword(row.password_hash)

  // 1. Create Supabase auth user
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: row.email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: row.first_name,
      last_name: row.last_name,
      role: row.role,
    },
  })

  if (authError || !authUser.user) {
    throw new Error(`Failed to create auth user: ${authError?.message ?? 'Unknown error'}`)
  }

  const profileId = authUser.user.id

  // 2. Create profile record
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: profileId,
      school_id: row.school_id,
      role: row.role,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      phone: row.phone,
      is_active: true,
    })
    .select()
    .single()

  if (profileError) {
    // Rollback auth user on profile failure
    await supabase.auth.admin.deleteUser(profileId).catch(() => {})
    throw new Error(`Failed to create profile: ${profileError.message}`)
  }

  // 3. Create the role-specific record so the user appears in the correct list.
  // campus_id is the actual campus school_id; fall back to school_id if not set.
  const campusId = row.campus_id ?? row.school_id

  if (['teacher', 'staff', 'librarian', 'counselor'].includes(row.role)) {
    const rolePrefix =
      row.role === 'teacher'   ? 'TCH' :
      row.role === 'librarian' ? 'LIB' :
      row.role === 'counselor' ? 'CSL' : 'STF'
    const employeeNumber = `${rolePrefix}-${Date.now().toString().slice(-6)}`

    const { error: staffError } = await supabase
      .from('staff')
      .insert({
        profile_id: profileId,
        school_id: campusId,
        employee_number: employeeNumber,
        role: row.role,
        employment_type: 'full_time',
        payment_type: 'fixed_salary',
        is_active: true,
        permissions: {},
        custom_fields: {},
        created_by: reviewedBy,
      })

    if (staffError) {
      console.error('⚠️ Failed to create staff record for approved signup:', staffError.message)
    } else {
      await supabase.from('profiles').update({ school_id: campusId }).eq('id', profileId)
    }

  } else if (row.role === 'student') {
    const studentNumber = `STU-${Date.now().toString().slice(-8)}`
    const extra = (row.extra_data ?? {}) as Record<string, unknown>

    const { error: studentError } = await supabase
      .from('students')
      .insert({
        profile_id: profileId,
        school_id: campusId,
        student_number: studentNumber,
        ...(extra.grade_level_id ? { grade_level_id: extra.grade_level_id } : {}),
        ...(extra.grade_level ? { grade_level: extra.grade_level } : {}),
        medical_info: {},
        custom_fields: {},
      })

    if (studentError) {
      console.error('⚠️ Failed to create student record for approved signup:', studentError.message)
    } else {
      await supabase.from('profiles').update({ school_id: campusId }).eq('id', profileId)
    }

  } else if (row.role === 'parent') {
    const { error: parentError } = await supabase
      .from('parents')
      .insert({
        profile_id: profileId,
        school_id: campusId,
        metadata: {},
        custom_fields: {},
      })

    if (parentError) {
      console.error('⚠️ Failed to create parent record for approved signup:', parentError.message)
    } else {
      await supabase.from('profiles').update({ school_id: campusId }).eq('id', profileId)
    }
  }

  // 4. Mark as approved
  const { data: updated, error: updateError } = await supabase
    .from('pending_signups')
    .update({
      status: 'approved',
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      id, school_id, campus_id, signup_link_id, role, first_name, last_name,
      email, phone, extra_data, status, reviewed_by, reviewed_at, rejection_reason,
      created_at, updated_at
    `)
    .single()

  if (updateError) throw updateError

  // 6. Generate login credentials and store them on the profile
  let plainPassword: string | undefined
  try {
    const creds = await generateCredentials()
    plainPassword = creds.plainPassword
    const hashedPassword = await bcrypt.hash(creds.plainPassword, 10)
    await supabase
      .from('profiles')
      .update({
        username: creds.username,
        system_password: hashedPassword,
        force_password_change: true,
        username_generated_at: new Date().toISOString(),
      })
      .eq('id', profileId)
    // Sync Supabase auth password so username-based login works immediately
    await supabase.auth.admin
      .updateUserById(profileId, { password: creds.plainPassword })
      .catch(() => {})
  } catch {
    // Non-fatal — user can still log in with their signup password
  }

  // 7. Send approval email to user (non-blocking — never breaks the approval)
  sendApprovalEmail(row.school_id, row.email, row.first_name, row.role).catch(() => {})

  return { profile, pendingSignup: stripPasswordHash(updated) as PendingSignup, plainPassword }
}

export async function rejectPendingSignup(
  id: string,
  schoolId: string,
  reviewedBy: string,
  reason: string | null
): Promise<PendingSignup> {
  // Verify ownership and pending status
  const { data: existing } = await supabase
    .from('pending_signups')
    .select('id, email, first_name, status')
    .eq('id', id)
    .eq('school_id', schoolId)
    .single()

  if (!existing) throw new Error('Pending signup not found')
  if (existing.status !== 'pending') throw new Error('Already reviewed')

  const { data, error } = await supabase
    .from('pending_signups')
    .update({
      status: 'rejected',
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason ?? null,
    })
    .eq('id', id)
    .select(`
      id, school_id, campus_id, signup_link_id, role, first_name, last_name,
      email, phone, extra_data, status, reviewed_by, reviewed_at, rejection_reason,
      created_at, updated_at
    `)
    .single()

  if (error) throw error

  // Send rejection email to user (non-blocking — never breaks the rejection)
  sendRejectionEmail(schoolId, existing.email, existing.first_name, reason).catch(() => {})

  return stripPasswordHash(data) as PendingSignup
}

export async function isEmailAlreadyUsed(email: string, schoolId: string): Promise<boolean> {
  // Check profiles table (existing users)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (profile) return true

  // Check pending_signups (already applied, not yet approved)
  const { data: pending } = await supabase
    .from('pending_signups')
    .select('id')
    .eq('email', email)
    .eq('school_id', schoolId)
    .in('status', ['pending', 'approved'])
    .maybeSingle()

  return !!pending
}

export async function getPendingCount(schoolId: string): Promise<number> {
  const { count } = await supabase
    .from('pending_signups')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('status', 'pending')

  return count ?? 0
}

// ── Email helpers ───────────────────────────────────────────────────────────

const frontendUrl = (): string =>
  (process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_FRONTEND_URL ?? '').replace(/\/$/, '')

/** Get school name for email subject lines */
async function getSchoolName(schoolId: string): Promise<string> {
  const { data } = await supabase
    .from('schools')
    .select('name')
    .eq('id', schoolId)
    .maybeSingle()
  return data?.name ?? 'Your School'
}

/**
 * Get transporter for a school — uses school SMTP config if set up,
 * falls back to global env vars. Returns null if nothing is configured.
 */
async function getMailer(schoolId: string) {
  // Try school-specific SMTP first
  try {
    return await getSchoolMailer(schoolId)
  } catch {
    // Fall back to global env-var SMTP if school hasn't configured SMTP
    const host = process.env.SMTP_HOST
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS
    if (!host || !user || !pass) return null // No SMTP at all — skip silently

    const { createTransporter } = await import('../config/mail')
    const transporter = createTransporter({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      user,
      pass,
    })
    const from = process.env.SMTP_FROM ?? process.env.SMTP_FROM_EMAIL ?? user
    return { transporter, fromAddress: from }
  }
}

/** Reusable HTML email wrapper — professional branded layout */
function emailTemplate(options: {
  title: string
  preheader: string
  bodyHtml: string
  schoolName: string
  ctaLabel?: string
  ctaUrl?: string
  accentColor?: string
}): string {
  const {
    title,
    preheader,
    bodyHtml,
    schoolName,
    ctaLabel,
    ctaUrl,
    accentColor = '#022172',
  } = options

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <!-- Preheader (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;color:#f4f6f9;">${preheader}</div>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

          <!-- Header Band -->
          <tr>
            <td style="background:linear-gradient(135deg,#57A3CC 0%,${accentColor} 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                ${schoolName}
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.80);font-size:13px;">
                Powered by iStudently
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              ${bodyHtml}
            </td>
          </tr>

          ${ctaLabel && ctaUrl ? `
          <!-- CTA Button -->
          <tr>
            <td style="padding:0 40px 40px;text-align:center;">
              <a href="${ctaUrl}"
                 style="display:inline-block;background:linear-gradient(135deg,#57A3CC 0%,${accentColor} 100%);
                        color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;
                        font-size:15px;font-weight:600;letter-spacing:0.2px;">
                ${ctaLabel}
              </a>
            </td>
          </tr>` : ''}

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e8ecf0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                This email was sent by ${schoolName} via iStudently.<br>
                If you did not request this, you can ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Notify admin of new signup ──────────────────────────────────────────────

export async function notifyAdminOfNewSignup(
  schoolId: string,
  firstName: string,
  lastName: string,
  email: string,
  role: string
): Promise<void> {
  const { data: admin } = await supabase
    .from('profiles')
    .select('email')
    .eq('school_id', schoolId)
    .eq('role', 'admin')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (!admin?.email) return

  const mailer = await getMailer(schoolId)
  if (!mailer) return // No SMTP configured — skip

  const schoolName = await getSchoolName(schoolId)
  const reviewUrl = `${frontendUrl()}/admin/pending-approvals`

  const bodyHtml = `
    <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;font-weight:700;">
      New Signup Request 📬
    </h2>
    <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
      A new user has submitted a registration request via your signup link and is waiting for your approval.
    </p>
    <table style="width:100%;border:1px solid #e2e8f0;border-radius:8px;border-collapse:collapse;margin-bottom:24px;">
      <tr style="background:#f8fafc;">
        <td style="padding:12px 16px;color:#64748b;font-size:13px;font-weight:600;width:120px;border-bottom:1px solid #e2e8f0;">Name</td>
        <td style="padding:12px 16px;color:#1e293b;font-size:14px;font-weight:600;border-bottom:1px solid #e2e8f0;">${firstName} ${lastName}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;color:#64748b;font-size:13px;font-weight:600;border-bottom:1px solid #e2e8f0;">Email</td>
        <td style="padding:12px 16px;color:#1e293b;font-size:14px;border-bottom:1px solid #e2e8f0;">${email}</td>
      </tr>
      <tr style="background:#f8fafc;">
        <td style="padding:12px 16px;color:#64748b;font-size:13px;font-weight:600;">Role</td>
        <td style="padding:12px 16px;">
          <span style="background:#dbeafe;color:#1d4ed8;padding:3px 10px;border-radius:20px;font-size:13px;font-weight:600;text-transform:capitalize;">
            ${role}
          </span>
        </td>
      </tr>
    </table>
    <p style="margin:0;color:#64748b;font-size:14px;">
      Please review and approve or reject this account in your admin dashboard.
    </p>
  `

  await sendEmail({
    to: admin.email,
    subject: `New Signup Request: ${firstName} ${lastName} (${role})`,
    html: emailTemplate({
      title: `New Signup Request — ${schoolName}`,
      preheader: `${firstName} ${lastName} has requested to join as ${role}`,
      bodyHtml,
      schoolName,
      ctaLabel: 'Review Request →',
      ctaUrl: reviewUrl,
    }),
    text: `New signup request from ${firstName} ${lastName} (${email}) as ${role}. Review at: ${reviewUrl}`,
    transporter: mailer.transporter,
    fromAddress: mailer.fromAddress,
  })
}

// ── Approval email to user ──────────────────────────────────────────────────

export async function sendApprovalEmail(
  schoolId: string,
  toEmail: string,
  firstName: string,
  role: string
): Promise<void> {
  const mailer = await getMailer(schoolId)
  if (!mailer) return

  const schoolName = await getSchoolName(schoolId)
  const loginUrl = `${frontendUrl()}/auth/login`

  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1)

  const bodyHtml = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="width:64px;height:64px;background:#dcfce7;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
        <span style="font-size:28px;">✅</span>
      </div>
      <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;font-weight:700;">
        Welcome aboard, ${firstName}!
      </h2>
      <p style="margin:0;color:#64748b;font-size:15px;">
        Your account has been approved
      </p>
    </div>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin-bottom:24px;">
      <p style="margin:0;color:#166534;font-size:15px;text-align:center;">
        🎉 You can now log in to <strong>${schoolName}</strong> as a
        <strong style="text-transform:capitalize;">${roleLabel}</strong>
      </p>
    </div>

    <p style="margin:0 0 8px;color:#475569;font-size:14px;line-height:1.6;">
      Use your registered email address and the password you chose during signup to access your account.
    </p>
  `

  await sendEmail({
    to: toEmail,
    subject: `✅ Your account has been approved — ${schoolName}`,
    html: emailTemplate({
      title: `Account Approved — ${schoolName}`,
      preheader: `Your account at ${schoolName} has been approved. Log in now.`,
      bodyHtml,
      schoolName,
      ctaLabel: 'Log In Now →',
      ctaUrl: loginUrl,
    }),
    text: `Your account at ${schoolName} has been approved. You can now log in as ${role} at ${loginUrl}`,
    transporter: mailer.transporter,
    fromAddress: mailer.fromAddress,
  })
}

// ── Rejection email to user ─────────────────────────────────────────────────

export async function sendRejectionEmail(
  schoolId: string,
  toEmail: string,
  firstName: string,
  reason: string | null
): Promise<void> {
  const mailer = await getMailer(schoolId)
  if (!mailer) return

  const schoolName = await getSchoolName(schoolId)

  const bodyHtml = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="width:64px;height:64px;background:#fef2f2;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
        <span style="font-size:28px;">❌</span>
      </div>
      <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;font-weight:700;">
        Account Not Approved
      </h2>
      <p style="margin:0;color:#64748b;font-size:15px;">
        Hello ${firstName}, we have an update on your account request.
      </p>
    </div>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:20px;margin-bottom:24px;">
      <p style="margin:0;color:#991b1b;font-size:15px;">
        Your account request for <strong>${schoolName}</strong> has been reviewed and was
        <strong>not approved</strong> at this time.
      </p>
    </div>

    ${reason ? `
    <div style="background:#f8fafc;border-left:4px solid #94a3b8;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px;">
      <p style="margin:0 0 4px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Reason</p>
      <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.6;">${reason}</p>
    </div>` : ''}

    <p style="margin:0;color:#64748b;font-size:14px;line-height:1.6;">
      If you believe this is a mistake or have questions, please contact your school administrator directly.
    </p>
  `

  await sendEmail({
    to: toEmail,
    subject: `Account Application Update — ${schoolName}`,
    html: emailTemplate({
      title: `Account Update — ${schoolName}`,
      preheader: `Your account request at ${schoolName} has been reviewed.`,
      bodyHtml,
      schoolName,
      accentColor: '#7f1d1d',
    }),
    text: `Your account request at ${schoolName} was not approved.${reason ? ` Reason: ${reason}` : ''} Please contact your school administrator.`,
    transporter: mailer.transporter,
    fromAddress: mailer.fromAddress,
  })
}
