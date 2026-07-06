'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Printer, Loader2, X, FileText } from 'lucide-react'
import { openPrintPreview, type PrintSchool } from '@/lib/utils/printLayout'
import { getPdfHeaderFooter, type PdfHeaderFooterSettings } from '@/lib/api/school-settings'
import { useSchoolSettings } from '@/context/SchoolSettingsContext'
import { useCampus } from '@/context/CampusContext'
import type { PayslipByPeriod } from '@/lib/api/salary'

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function fmt(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ---------------------------------------------------------------------------
// HTML builder — produces self-contained body HTML for openPrintPreview()
// ---------------------------------------------------------------------------

export function buildPayslipHtml(payslip: PayslipByPeriod, school: PrintSchool): string {
  const staffName = payslip.staff
    ? `${payslip.staff.profile.first_name} ${payslip.staff.profile.last_name}`.trim()
    : 'Staff Member'

  const designation = payslip.staff?.profile?.role
    ? payslip.staff.profile.role.charAt(0).toUpperCase() + payslip.staff.profile.role.slice(1)
    : payslip.staff?.title || 'Staff'

  const department = payslip.staff?.department || ''
  const employeeId = payslip.staff?.employee_number || payslip.staff_id?.slice(0, 8) || '-'
  const period = `${MONTH_NAMES[payslip.month] || payslip.month} ${payslip.year}`

  // ── Earnings rows ──────────────────────────────────────────────────────────
  const earningRows: { label: string; amount: number; sub?: boolean }[] = []

  earningRows.push({ label: 'Base Salary', amount: payslip.base_salary })

  for (const a of payslip.allowances_breakdown || []) {
    if (a.allowance_type === 'attendance_bonus' || a.allowance_type === 'monthly_bonus') {
      earningRows.push({ label: a.description || a.allowance_type, amount: a.amount })
    } else {
      earningRows.push({ label: a.description || a.allowance_type, amount: a.amount })
    }
  }

  // Performance bonuses (rewards)
  const rewardItems = (payslip.performance_log_items || []).filter(p => p.action_type === 'reward_redemption' && p.fine > 0)
  if (rewardItems.length > 0) {
    const totalBonus = rewardItems.reduce((s, p) => s + p.fine, 0)
    earningRows.push({ label: 'Performance Bonuses', amount: totalBonus })
    for (const r of rewardItems) {
      earningRows.push({ label: `• ${r.action_name}`, amount: r.fine, sub: true })
    }
  }

  // Course / teaching commissions
  if ((payslip.commissions_breakdown || []).length > 0) {
    const totalComm = payslip.commissions_breakdown.reduce((s, c) => s + c.amount, 0)
    earningRows.push({ label: 'Teaching Commissions', amount: totalComm })
    for (const c of payslip.commissions_breakdown) {
      earningRows.push({ label: `• ${c.description} (${c.hours}h × ${fmt(c.rate)})`, amount: c.amount, sub: true })
    }
  }

  const totalEarnings = payslip.base_salary + (payslip.total_allowances || 0) + (payslip.performance_bonuses || 0) + payslip.commissions_breakdown.reduce((s, c) => s + c.amount, 0)

  // ── Deduction rows ─────────────────────────────────────────────────────────
  const deductionRows: { label: string; amount: number; sub?: boolean }[] = []

  // Attendance-based deductions from deductions_breakdown
  const attendanceDeds = (payslip.deductions_breakdown || []).filter(
    d => d.deduction_type === 'absence' || d.deduction_type === 'late'
  )
  if (attendanceDeds.length > 0) {
    const total = attendanceDeds.reduce((s, d) => s + d.amount, 0)
    deductionRows.push({ label: 'Attendance Deductions', amount: total })
    for (const d of attendanceDeds) {
      deductionRows.push({ label: `• ${d.description}`, amount: d.amount, sub: true })
    }
  }

  // Performance fines from individual log items
  const fineItems = (payslip.performance_log_items || []).filter(p => p.action_type === 'violation_demerit' && p.fine > 0)
  if (fineItems.length > 0) {
    const totalFines = fineItems.reduce((s, p) => s + p.fine, 0)
    deductionRows.push({ label: 'Performance Fines', amount: totalFines })
    for (const f of fineItems) {
      deductionRows.push({ label: `• ${f.action_name}`, amount: f.fine, sub: true })
    }
  }

  // Other deductions (monthly deductions, fixed deductions)
  const otherDeds = (payslip.deductions_breakdown || []).filter(
    d => d.deduction_type !== 'absence' && d.deduction_type !== 'late'
  )
  for (const d of otherDeds) {
    deductionRows.push({ label: d.description || d.deduction_type, amount: d.amount })
  }

  // Advance recovery
  if ((payslip.advance_deduction || 0) > 0) {
    deductionRows.push({ label: 'Salary Advance Recovery', amount: payslip.advance_deduction })
  }

  const totalDeductions = payslip.total_deductions || 0
  const netSalary = payslip.net_salary || 0

  const rowHtml = (label: string, amount: number, sub = false, color = '#1a1a1a'): string =>
    `<tr>
      <td style="padding:6px 10px;${sub ? 'padding-left:24px;color:#64748b;font-size:12px;' : 'font-weight:500;'}">${label}</td>
      <td style="padding:6px 10px;text-align:right;${sub ? 'color:#64748b;font-size:12px;' : `color:${color};font-weight:600;`}">${fmt(amount)}</td>
    </tr>`

  const earningRowsHtml = earningRows.map(r => rowHtml(r.label, r.amount, r.sub, '#16a34a')).join('')
  const deductionRowsHtml = deductionRows.map(r => rowHtml(r.label, r.amount, r.sub, '#dc2626')).join('')

  // Pad the shorter column so both tables match visually
  const maxRows = Math.max(earningRows.length, deductionRows.length)
  const earningPads = Math.max(0, maxRows - earningRows.length)
  const deductionPads = Math.max(0, maxRows - deductionRows.length)
  const padRowHtml = `<tr><td style="padding:6px 10px;">&nbsp;</td><td></td></tr>`

  return `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:900px;margin:0 auto;color:#1a1a1a;font-size:13px;">

  <!-- Employee Info Banner -->
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px 20px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#64748b;letter-spacing:1px;margin-bottom:4px;">Employee</div>
      <div style="font-size:20px;font-weight:700;color:#1e3a5f;">${staffName}</div>
      <div style="color:#64748b;margin-top:3px;">${designation}${department ? ' — ' + department : ''}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#64748b;letter-spacing:1px;margin-bottom:4px;">Staff ID</div>
      <div style="font-size:15px;font-weight:600;">${employeeId}</div>
      <div style="color:#64748b;margin-top:3px;">Statement: ${period}</div>
    </div>
  </div>

  <!-- Two-Column Ledger -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">

    <!-- Earnings -->
    <div style="border:1px solid #d1fae5;border-radius:6px;overflow:hidden;">
      <div style="background:#f0fdf4;padding:10px 14px;border-bottom:1px solid #d1fae5;">
        <span style="font-weight:700;color:#16a34a;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">
          ✚ Earnings / المرتب والمكافآت
        </span>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        ${earningRowsHtml}
        ${padRowHtml.repeat(earningPads)}
      </table>
      <div style="background:#f0fdf4;border-top:2px solid #d1fae5;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:700;color:#15803d;">Total Earnings</span>
        <span style="font-weight:800;font-size:15px;color:#15803d;">${fmt(totalEarnings)}</span>
      </div>
    </div>

    <!-- Deductions -->
    <div style="border:1px solid #fee2e2;border-radius:6px;overflow:hidden;">
      <div style="background:#fff7f7;padding:10px 14px;border-bottom:1px solid #fee2e2;">
        <span style="font-weight:700;color:#dc2626;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">
          ✖ Deductions / الاستقطاعات والخصومات
        </span>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        ${deductionRowsHtml}
        ${padRowHtml.repeat(deductionPads)}
        ${deductionRows.length === 0 ? '<tr><td colspan="2" style="padding:20px;text-align:center;color:#94a3b8;font-size:12px;">No deductions this period</td></tr>' : ''}
      </table>
      <div style="background:#fff7f7;border-top:2px solid #fee2e2;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:700;color:#b91c1c;">Total Deductions</span>
        <span style="font-weight:800;font-size:15px;color:#b91c1c;">${fmt(totalDeductions)}</span>
      </div>
    </div>
  </div>

  <!-- Net Salary Banner -->
  <div style="background:#1e3a5f;color:#fff;border-radius:6px;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
    <div>
      <div style="font-size:13px;opacity:0.7;margin-bottom:2px;">NET PAYABLE SALARY</div>
      <div style="font-size:14px;opacity:0.8;">صافي المرتب</div>
    </div>
    <div style="font-size:28px;font-weight:800;letter-spacing:-0.5px;">${fmt(netSalary)}</div>
  </div>

  <!-- Sign-off Area -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;margin-top:32px;padding-top:20px;border-top:1px solid #e2e8f0;">
    <div style="text-align:center;">
      <div style="border-top:1px solid #94a3b8;padding-top:8px;margin-top:48px;font-size:12px;color:#64748b;">Admin Signature</div>
    </div>
    <div style="text-align:center;">
      <div style="border-top:1px solid #94a3b8;padding-top:8px;margin-top:48px;font-size:12px;color:#64748b;">HR Approval</div>
    </div>
    <div style="text-align:center;">
      <div style="border-top:1px solid #94a3b8;padding-top:8px;margin-top:48px;font-size:12px;color:#64748b;">Official School Stamp</div>
    </div>
  </div>
</div>
`
}

// ---------------------------------------------------------------------------
// PayslipPreviewDialog — opens print preview or shows payslip inline
// ---------------------------------------------------------------------------

interface PayslipPreviewDialogProps {
  payslip: PayslipByPeriod | null
  open: boolean
  onClose: () => void
}

export function PayslipPreviewDialog({ payslip, open, onClose }: PayslipPreviewDialogProps) {
  const campusCtx = useCampus()
  const { isPluginActive } = useSchoolSettings()
  const [printing, setPrinting] = useState(false)
  const t = useTranslations('payslip')

  const school: PrintSchool = {
    name: (campusCtx?.selectedCampus as any)?.name || 'School',
    logo_url: (campusCtx?.selectedCampus as any)?.logo_url,
    address: (campusCtx?.selectedCampus as any)?.address,
    phone: (campusCtx?.selectedCampus as any)?.phone,
  }

  async function handlePrint() {
    if (!payslip) return
    setPrinting(true)
    try {
      let pdfSettings: PdfHeaderFooterSettings | null = null
      const campusId = campusCtx?.selectedCampus?.id
      if (campusId) {
        const r = await getPdfHeaderFooter(campusId)
        if (r.success && r.data) pdfSettings = r.data
      }

      const staffName = payslip.staff
        ? `${payslip.staff.profile.first_name} ${payslip.staff.profile.last_name}`.trim()
        : 'Payslip'

      openPrintPreview({
        title: `Payslip — ${staffName} — ${MONTH_NAMES[payslip.month]} ${payslip.year}`,
        bodyHtml: buildPayslipHtml(payslip, school),
        bodyStyles: '',
        school,
        pdfSettings,
        pluginActive: isPluginActive('pdf_header_footer'),
      })
    } finally {
      setPrinting(false)
    }
  }

  const staffName = payslip?.staff
    ? `${payslip.staff.profile.first_name} ${payslip.staff.profile.last_name}`.trim()
    : 'Staff Member'

  const period = payslip ? `${MONTH_NAMES[payslip.month]} ${payslip.year}` : ''

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  }

  const statusLabels: Record<string, string> = {
    pending: t('badge_pending'),
    approved: t('badge_approved'),
    paid: t('badge_paid'),
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t('title', { name: staffName, period })}
            {payslip?.status && (
              <Badge variant="outline" className={`ml-2 text-xs ${statusColors[payslip.status] || ''}`}>
                {statusLabels[payslip.status] ?? payslip.status}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {payslip && (
          <div className="space-y-4">
            {/* Employee info */}
            <div className="flex justify-between items-start bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{t('label_employee')}</p>
                <p className="text-lg font-bold text-[#1e3a5f] dark:text-blue-400">{staffName}</p>
                <p className="text-sm text-muted-foreground">
                  {payslip.staff?.profile?.role} {payslip.staff?.department ? `— ${payslip.staff.department}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{t('label_id_period')}</p>
                <p className="font-semibold">{payslip.staff?.employee_number || '-'}</p>
                <p className="text-sm text-muted-foreground">{period}</p>
              </div>
            </div>

            {/* Two columns */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              {/* Earnings */}
              <div className="rounded-lg border border-green-200 dark:border-green-900/50 overflow-hidden">
                <div className="bg-green-50 dark:bg-green-950/30 px-3 py-2 border-b border-green-200 dark:border-green-900/50">
                  <span className="font-semibold text-green-700 dark:text-green-400 text-xs uppercase tracking-wide">{t('label_earnings')}</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  <div className="flex justify-between px-3 py-2">
                    <span className="font-medium">{t('label_base_salary')}</span>
                    <span className="font-semibold">{fmt(payslip.base_salary)}</span>
                  </div>
                  {(payslip.allowances_breakdown || []).map((a, i) => (
                    <div key={i} className="flex justify-between px-3 py-1.5 text-xs text-muted-foreground">
                      <span>{a.description || a.allowance_type}</span>
                      <span>{fmt(a.amount)}</span>
                    </div>
                  ))}
                  {(payslip.performance_log_items || []).filter(p => p.action_type === 'reward_redemption' && p.fine > 0).map((p, i) => (
                    <div key={i} className="flex justify-between px-3 py-1.5 text-xs text-green-700 dark:text-green-400">
                      <span>• {p.action_name}</span>
                      <span>+{fmt(p.fine)}</span>
                    </div>
                  ))}
                  {(payslip.commissions_breakdown || []).map((c, i) => (
                    <div key={i} className="flex justify-between px-3 py-1.5 text-xs text-muted-foreground">
                      <span>• {c.description}</span>
                      <span>{fmt(c.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-green-50 dark:bg-green-950/30 border-t-2 border-green-200 dark:border-green-900/50 px-3 py-2 flex justify-between">
                  <span className="font-bold text-green-700 dark:text-green-400">{t('label_total')}</span>
                  <span className="font-bold text-green-700 dark:text-green-400">
                    {fmt(payslip.base_salary + (payslip.total_allowances || 0) + (payslip.performance_bonuses || 0) + (payslip.commissions_breakdown || []).reduce((s, c) => s + c.amount, 0))}
                  </span>
                </div>
              </div>

              {/* Deductions */}
              <div className="rounded-lg border border-red-200 dark:border-red-900/50 overflow-hidden">
                <div className="bg-red-50 dark:bg-red-950/30 px-3 py-2 border-b border-red-200 dark:border-red-900/50">
                  <span className="font-semibold text-red-700 dark:text-red-400 text-xs uppercase tracking-wide">{t('label_deductions')}</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {(payslip.deductions_breakdown || []).map((d, i) => (
                    <div key={i} className="flex justify-between px-3 py-1.5">
                      <span className="text-muted-foreground">{d.description || d.deduction_type}</span>
                      <span className="text-red-600 dark:text-red-400 font-medium">{fmt(d.amount)}</span>
                    </div>
                  ))}
                  {(payslip.performance_log_items || []).filter(p => p.action_type === 'violation_demerit' && p.fine > 0).map((p, i) => (
                    <div key={i} className="flex justify-between px-3 py-1.5 text-xs text-red-600 dark:text-red-400">
                      <span>• {p.action_name}</span>
                      <span>{fmt(p.fine)}</span>
                    </div>
                  ))}
                  {(payslip.advance_deduction || 0) > 0 && (
                    <div className="flex justify-between px-3 py-1.5">
                      <span className="text-muted-foreground">{t('label_advance_recovery')}</span>
                      <span className="text-red-600 dark:text-red-400 font-medium">{fmt(payslip.advance_deduction)}</span>
                    </div>
                  )}
                  {(payslip.deductions_breakdown || []).length === 0 && (payslip.performance_log_items || []).filter(p => p.action_type === 'violation_demerit').length === 0 && !(payslip.advance_deduction) && (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">{t('label_no_deductions')}</div>
                  )}
                </div>
                <div className="bg-red-50 dark:bg-red-950/30 border-t-2 border-red-200 dark:border-red-900/50 px-3 py-2 flex justify-between">
                  <span className="font-bold text-red-700 dark:text-red-400">{t('label_total')}</span>
                  <span className="font-bold text-red-700 dark:text-red-400">{fmt(payslip.total_deductions || 0)}</span>
                </div>
              </div>
            </div>

            {/* Net salary */}
            <div className="bg-[#1e3a5f] text-white rounded-lg px-6 py-4 flex justify-between items-center">
              <div>
                <p className="text-sm opacity-70">{t('label_net_salary')}</p>
                <p className="text-xs opacity-60">{t('label_net_salary_ar')}</p>
              </div>
              <p className="text-3xl font-bold">{fmt(payslip.net_salary || 0)}</p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>
                <X className="h-4 w-4 mr-1.5" /> {t('btn_close')}
              </Button>
              <Button onClick={handlePrint} disabled={printing}>
                {printing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Printer className="h-4 w-4 mr-1.5" />}
                {t('btn_print')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
