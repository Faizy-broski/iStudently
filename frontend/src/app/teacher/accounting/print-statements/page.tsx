"use client"

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { getStaffOwnSalaries, getStaffOwnPayments } from '@/lib/api/accounting'
import { Loader2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { useRouter } from 'next/navigation'
import { openPdfDownload } from '@/lib/utils/printLayout'
import { type PdfHeaderFooterSettings, getPdfHeaderFooter } from '@/lib/api/school-settings'
import { useSchoolSettings } from '@/context/SchoolSettingsContext'
import { toast } from 'sonner'

export default function TeacherPrintStatementsAutoPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const campusContext = useCampus()
  const { isPluginActive } = useSchoolSettings()
  
  const campusId = campusContext?.selectedCampus?.id
  const campus = campusContext?.selectedCampus
  const campusName = campus?.name || "School"

  const [pdfSettings, setPdfSettings] = useState<PdfHeaderFooterSettings | null>(null)
  
  // Only fire once to avoid loops
  const [hasTriggered, setHasTriggered] = useState(false)

  useEffect(() => {
    if (campusId) {
      getPdfHeaderFooter(campusId).then(r => { if (r.success && r.data) setPdfSettings(r.data) })
    }
  }, [campusId])

  const { data: salariesRes, isLoading: loadingSalaries } = useSWR(
    'teacher-own-salaries',
    () => getStaffOwnSalaries(),
    { revalidateOnFocus: false }
  )

  const { data: paymentsRes, isLoading: loadingPayments } = useSWR(
    'teacher-own-payments',
    () => getStaffOwnPayments(),
    { revalidateOnFocus: false }
  )

  const salaries = salariesRes?.data || []
  const payments = paymentsRes?.data || []
  const isLoading = loadingSalaries || loadingPayments

  const transactions = useMemo(() => {
    const combined: any[] = []
    salaries.forEach(s => combined.push({
      ...s,
      type: 'salary',
      displayDate: s.assigned_date,
      debit: Number(s.amount) || 0,
      credit: 0
    }))
    payments.forEach(p => combined.push({
      ...p,
      type: 'payment',
      displayDate: p.payment_date,
      debit: 0,
      credit: Number(p.amount) || 0
    }))

    return combined.sort((a, b) => new Date(a.displayDate).getTime() - new Date(b.displayDate).getTime())
  }, [salaries, payments])

  useEffect(() => {
    async function executeSilentPrint() {
      if (isLoading || hasTriggered) return
      
      setHasTriggered(true)

      const totalSalaries = salaries.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
      const totalPayments = payments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
      const finalBalance = totalSalaries - totalPayments

      // Build HTML for the PDF engine
      let bodyHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 900px; margin: 0 auto; color: #1a1a1a;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="font-size: 28px; font-weight: 300; margin: 0; color: #1a1a1a;">Staff Statement</h1>
          <p style="color: #64748b; margin-top: 5px; font-size: 15px;">Historical Ledger of Salaries & Payments</p>
        </div>

        <div style="display: flex; justify-content: space-between; background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 25px;">
          <div>
            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 1px; margin-bottom: 4px;">Staff Member</div>
            <div style="font-size: 20px; font-weight: 500; color: #1e3a5f;">${profile?.first_name || ''} ${profile?.last_name || ''}</div>
            <div style="font-size: 13px; color: #64748b; margin-top: 4px;">${profile?.email || ''}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 1px; margin-bottom: 4px;">Statement Date</div>
            <div style="font-size: 16px; font-weight: 500;">${format(new Date(), 'MMMM d, yyyy')}</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 25px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
              <th style="padding: 12px; text-align: left; font-weight: 700; color: #334155;">DATE</th>
              <th style="padding: 12px; text-align: left; font-weight: 700; color: #334155;">DESCRIPTION</th>
              <th style="padding: 12px; text-align: left; font-weight: 700; color: #334155;">COMMENTS</th>
              <th style="padding: 12px; text-align: right; font-weight: 700; color: #334155;">SALARY (DEBIT)</th>
              <th style="padding: 12px; text-align: right; font-weight: 700; color: #334155;">PAID (CREDIT)</th>
              <th style="padding: 12px; text-align: right; font-weight: 800; color: #1e3a5f;">BALANCE</th>
            </tr>
          </thead>
          <tbody>
      `

      if (transactions.length === 0) {
        bodyHtml += `
          <tr>
            <td colspan="6" style="padding: 40px; text-align: center; color: #64748b; border-bottom: 1px solid #e2e8f0; font-size: 15px;">No historical transactions found.</td>
          </tr>
        `
      } else {
        let runningBalance = 0;
        transactions.forEach((t) => {
          runningBalance += t.debit - t.credit;
          bodyHtml += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 12px;">${format(parseISO(t.displayDate), 'MMM d, yyyy')}</td>
              <td style="padding: 12px; font-weight: 500;">${t.type === 'salary' ? 'Salary Generated' : 'Payment Issued'}: ${t.title || 'Adjustment'}</td>
              <td style="padding: 12px; color: #64748b; font-size: 12px;">${t.comments || '-'}</td>
              <td style="padding: 12px; text-align: right;">${t.debit > 0 ? '$' + t.debit.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}</td>
              <td style="padding: 12px; text-align: right; color: #16a34a;">${t.credit > 0 ? '$' + t.credit.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}</td>
              <td style="padding: 12px; text-align: right; font-weight: 700; color: #1e3a5f;">$${runningBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            </tr>
          `
        })
      }

      bodyHtml += `
          </tbody>
        </table>

        <div style="display: flex; justify-content: flex-end;">
          <div style="width: 320px; border: 2px solid rgba(30, 58, 95, 0.15); background: rgba(30, 58, 95, 0.03); padding: 20px; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; color: #475569; margin-bottom: 10px; font-weight: 500;">
              <span>Total Salaries (Debit):</span>
              <span>$${totalSalaries.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #475569; margin-bottom: 12px; font-weight: 500;">
              <span>Total Payments (Credit):</span>
              <span>$${totalPayments.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
            <div style="height: 1px; background: rgba(30, 58, 95, 0.2); margin-bottom: 12px;"></div>
            <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; color: ${finalBalance >= 0 ? '#1e3a5f' : '#ef4444'};">
              <span>Total Due Balance:</span>
              <span>$${finalBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
          </div>
        </div>
      </div>
      `

      try {
        await openPdfDownload({
          title: "Staff Statement",
          bodyHtml,
          bodyStyles: "",
          school: campus ?? { name: campusName },
          pdfSettings,
          pluginActive: isPluginActive('pdf_header_footer'),
        })
        toast.success("Statement generated directly to PDF!")
      } catch (err) {
        toast.error("Failed to generate PDF")
      }

      // Natively redirect user immediately backward to remove the interface phantom
      router.back()
    }

    executeSilentPrint()
  }, [isLoading, hasTriggered, salaries, payments, transactions, profile, campus, campusName, pdfSettings, isPluginActive, router])

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <Loader2 className="h-10 w-10 animate-spin text-brand-blue mx-auto mb-6 opacity-70" />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Generating PDF Statement...</h2>
      <p className="text-muted-foreground">Silently constructing your secure accounting ledger. Please wait.</p>
    </div>
  )
}
