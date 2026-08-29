import type { CertificateTemplateConfig } from '@/lib/api/certificate-template'
import { substituteTokens } from '@/components/shared/CertificateCanvasRenderer'
import type { Student } from '@/lib/api/students'
import { formatDateWithPreference } from '@/lib/utils/dateFormat'

export { substituteTokens }

interface CampusLike {
  name?: string
  address?: string
  phone?: string
  logo_url?: string | null
  [key: string]: any
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c))
}

function currentAcademicYear(): string {
  const now = new Date()
  const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
  return `${year}-${year + 1}`
}

/** Build the {{token}} -> value data map for a student recipient. */
export function buildStudentCertificateData(student: Student, campus?: CampusLike | null): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile: any = student.profile || {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s: any = student
  const parentInfo = s.parent_links?.[0]?.parent?.profiles
  const parentName = parentInfo ? `${parentInfo.first_name || ''} ${parentInfo.last_name || ''}`.trim() : ''

  const dateOfBirth = student.custom_fields?.personal?.date_of_birth || profile.date_of_birth
  const admissionDate = student.custom_fields?.academic?.admission_date

  return {
    first_name: profile.first_name || '',
    last_name: profile.last_name || '',
    full_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
    father_name: profile.father_name || '',
    grandfather_name: profile.grandfather_name || '',
    email: profile.email || '',
    phone: profile.phone || '',
    photo_url: profile.profile_photo_url || profile.avatar_url || '',
    date_of_birth: dateOfBirth ? formatDateWithPreference(dateOfBirth) : '',
    blood_group: s.blood_group || student.custom_fields?.personal?.blood_group || '',
    student_id: student.student_number || '',
    student_number: student.student_number || '',
    admission_number: student.student_number || '',
    roll_number: student.student_number || '',
    grade_level: s.grade_level_name || s.grade?.name || student.grade_level || '',
    section: s.section_name || s.section?.name || '',
    admission_date: admissionDate ? formatDateWithPreference(admissionDate) : (s.created_at ? formatDateWithPreference(s.created_at) : ''),
    parent_name: parentName,
    parent_phone: parentInfo?.phone || '',
    academic_year: currentAcademicYear(),
    campus_name: campus?.name || '',
    campus_address: campus?.address || '',
    campus_phone: campus?.phone || '',
    school_name: campus?.name || '',
    school_logo: campus?.logo_url || '',
    school_principal: (campus as any)?.principal_name || (campus as any)?.principal || '',
    current_date: formatDateWithPreference(new Date()),
    issue_date: formatDateWithPreference(new Date()),
    valid_until: formatDateWithPreference(new Date(new Date().getFullYear() + 1, 7, 31)),
  }
}

/** Build the {{token}} -> value data map for a teacher or staff recipient. */
export function buildStaffCertificateData(member: any, campus?: CampusLike | null): Record<string, any> {
  const profile = member.profile || {}
  return {
    first_name: profile.first_name || '',
    last_name: profile.last_name || '',
    full_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
    email: profile.email || '',
    phone: profile.phone || '',
    photo_url: profile.profile_photo_url || profile.avatar_url || '',
    employee_id: member.employee_number || '',
    designation: member.title || '',
    role: member.title || '',
    department: member.department || '',
    qualification: member.qualifications || '',
    specialization: member.specialization || '',
    joining_date: member.date_of_joining ? formatDateWithPreference(member.date_of_joining) : '',
    academic_year: currentAcademicYear(),
    campus_name: campus?.name || '',
    campus_address: campus?.address || '',
    campus_phone: campus?.phone || '',
    school_name: campus?.name || '',
    school_logo: campus?.logo_url || '',
    school_principal: (campus as any)?.principal_name || (campus as any)?.principal || '',
    current_date: formatDateWithPreference(new Date()),
    issue_date: formatDateWithPreference(new Date()),
  }
}

/**
 * Renders a single certificate as a static HTML string sized exactly to the template's
 * A4 layout — used as one `.print-page` inside the batch print/PDF bodyHtml
 * (see frontend/src/lib/utils/printLayout.ts#openPdfDownload, which captures one PDF
 * page per `.print-page` element).
 */
export function renderCertificatePageHtml(config: CertificateTemplateConfig, data: Record<string, any>): string {
  const { layout, design, fields } = config

  const fieldsHtml = fields
    .map((field) => {
      const value = substituteTokens(field.token, data)
      const posStyle = `position:absolute;left:${field.position.x}px;top:${field.position.y}px;width:${field.size.width}px;height:${field.size.height}px;`

      if (field.type === 'image') {
        const isUrl = value && (value.startsWith('http') || value.startsWith('data:'))
        return isUrl
          ? `<div style="${posStyle}"><img src="${escapeHtml(value)}" style="width:100%;height:100%;object-fit:cover;" /></div>`
          : `<div style="${posStyle}"></div>`
      }

      const align = field.style?.align === 'center' ? 'center' : field.style?.align === 'right' ? 'flex-end' : 'flex-start'
      const textStyle =
        `font-size:${field.style?.fontSize ?? 14}px;font-weight:${field.style?.fontWeight ?? 'normal'};` +
        `color:${field.style?.color ?? '#000000'};text-align:${field.style?.align ?? 'left'};` +
        `display:flex;align-items:center;justify-content:${align};overflow:hidden;line-height:1.3;`

      return `<div style="${posStyle}${textStyle}"><span style="white-space:pre-wrap;">${escapeHtml(value)}</span></div>`
    })
    .join('')

  const canvasStyle =
    `position:relative;width:${layout.width}px;height:${layout.height}px;` +
    `background-color:${design.backgroundColor};border-style:solid;border-width:${design.borderWidth}px;` +
    `border-color:${design.borderColor};border-radius:${design.borderRadius}px;` +
    (design.backgroundImage ? `background-image:url(${design.backgroundImage});background-size:cover;background-position:center;` : '')

  return `<div class="print-page" style="width:${layout.width}px;height:${layout.height}px;margin:0 auto 24px;overflow:hidden;"><div style="${canvasStyle}">${fieldsHtml}</div></div>`
}
