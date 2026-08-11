'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { getStaffOwnSalaries, getStaffOwnPayments, type AccountingSalary } from '@/lib/api/accounting'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { DownloadCloud, Loader2, Search, Printer, Wallet } from 'lucide-react'
import { format, parseISO, getMonth, getYear } from 'date-fns'
import { getMyPayslip, requestMyAdvance, type PayslipByPeriod } from '@/lib/api/salary'
import { useAuth } from '@/context/AuthContext'
import { PayslipPreviewDialog } from '@/components/admin/PayslipDocument'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useSchoolSettings } from '@/hooks/useSchoolSettings'

export default function TeacherSalariesPage() {
  const t = useTranslations('teacherPortal.accounting.salaries')
  const tTotals = useTranslations('teacherPortal.accounting.totals')
  const tCommon = useTranslations('common')
  const { currencySymbol } = useSchoolSettings()
  const [searchQuery, setSearchQuery] = useState('')
  const { profile } = useAuth()
  const [previewPayslip, setPreviewPayslip] = useState<PayslipByPeriod | null>(null)
  const [printingId, setPrintingId] = useState<string | null>(null)
  const [advanceOpen, setAdvanceOpen] = useState(false)
  const [advanceAmount, setAdvanceAmount] = useState('')
  const [advanceReason, setAdvanceReason] = useState('')
  const [submittingAdvance, setSubmittingAdvance] = useState(false)

  const handlePrintPayStub = async (salary: AccountingSalary) => {
    if (!profile?.staff_id) return
    setPrintingId(salary.id)
    try {
      const d = parseISO(salary.assigned_date)
      const month = getMonth(d) + 1 // 1-12
      const year = getYear(d)
      const payslip = await getMyPayslip(month, year)
      setPreviewPayslip(payslip)
    } catch (e: any) {
      alert(e.message || 'Could not fetch pay stub.')
    } finally {
      setPrintingId(null)
    }
  }

  const handleRequestAdvance = async () => {
    const amount = parseFloat(advanceAmount)
    if (!amount || amount <= 0) {
      toast.error(t('advance_amount_required'))
      return
    }
    setSubmittingAdvance(true)
    try {
      await requestMyAdvance({ amount, reason: advanceReason || undefined })
      toast.success(t('advance_requested'))
      setAdvanceOpen(false)
      setAdvanceAmount('')
      setAdvanceReason('')
    } catch (e: any) {
      toast.error(e.message || t('advance_request_error'))
    } finally {
      setSubmittingAdvance(false)
    }
  }

  const { data: salariesRes, isLoading: loadingSalaries } = useSWR(
    'teacher-own-salaries',
    () => getStaffOwnSalaries(),
    { revalidateOnFocus: false }
  )

  const { data: paymentsRes } = useSWR(
    'teacher-own-payments-totals',
    () => getStaffOwnPayments(),
    { revalidateOnFocus: false }
  )

  const salaries = salariesRes?.data || []
  const payments = paymentsRes?.data || []

  // Filter logic
  const filteredSalaries = salaries.filter(s => 
    s.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.comments?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Calculations
  const totalSalaries = salaries.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
  const totalPayments = payments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
  const balance = totalSalaries - totalPayments

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2 mb-4 text-brand-teal">
        <div className="h-8 w-8 rounded bg-teal-100 flex items-center justify-center shrink-0">
          <Wallet className="h-5 w-5 text-teal-600" />
        </div>
        <h1 className="text-3xl font-light">{t('title')}</h1>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => setAdvanceOpen(true)}>
          {t('request_advance')}
        </Button>
      </div>

      <div className="flex justify-between items-center bg-gray-50 border-y py-2 px-1">
        <p className="text-sm font-semibold">{t('found_count', { count: filteredSalaries.length })}</p>
        <div className="flex gap-4 items-center">
          <Button variant="ghost" size="icon" onClick={handlePrint} title={t('print_export')}>
            <DownloadCloud className="h-5 w-5" />
          </Button>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={tCommon('search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 bg-white"
            />
          </div>
        </div>
      </div>

      <Card className="rounded-none shadow-sm border-gray-200">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="text-brand-blue font-bold">{t('col_salary')}</TableHead>
              <TableHead className="text-brand-blue font-bold">{t('col_amount')}</TableHead>
              <TableHead className="text-brand-blue font-bold">{t('col_assigned')}</TableHead>
              <TableHead className="text-brand-blue font-bold">{t('col_due')}</TableHead>
              <TableHead className="text-brand-blue font-bold">{t('col_comment')}</TableHead>
              <TableHead className="text-brand-blue font-bold">{t('col_file_attached')}</TableHead>
              <TableHead className="text-right text-brand-blue font-bold">{t('col_actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingSalaries ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : filteredSalaries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {t('no_salaries')}
                </TableCell>
              </TableRow>
            ) : (
              filteredSalaries.map((salary) => (
                <TableRow key={salary.id}>
                  <TableCell>{salary.title}</TableCell>
                  <TableCell>{currencySymbol}{Number(salary.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                  <TableCell>{format(parseISO(salary.assigned_date), 'MMMM d, yyyy')}</TableCell>
                  <TableCell>{salary.due_date ? format(parseISO(salary.due_date), 'MMMM d, yyyy') : '-'}</TableCell>
                  <TableCell>{salary.comments || '-'}</TableCell>
                  <TableCell>{salary.file_attached ? tCommon('yes') : ''}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePrintPayStub(salary)}
                      title={t('print_pay_stub')}
                      disabled={printingId === salary.id}
                    >
                      {printingId === salary.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4 text-brand-blue" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="bg-gray-50 border border-gray-200 rounded-none mt-8 w-max min-w-100">
        <CardContent className="p-4 space-y-1 text-sm font-medium">
          <div className="flex justify-between">
            <span className="text-right flex-1 pr-6">{tTotals('total_salaries')}</span>
            <span className="w-24 text-right">{currencySymbol}{totalSalaries.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-right flex-1 pr-6">{tTotals('less_total_payments')}</span>
            <span className="w-24 text-right">{currencySymbol}{totalPayments.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div className="flex justify-between font-bold pt-2">
            <span className="text-right flex-1 pr-6">{tTotals('balance')}</span>
            <span className="w-24 text-right">{currencySymbol}{balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
        </CardContent>
      </Card>
      
      {/* Hide elements when actually printing natively via window.print() */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
           body * { visibility: hidden; }
           .p-6 { visibility: visible; position: absolute; left: 0; top: 0; width: 100%; }
           .p-6 * { visibility: visible; }
           button, input { display: none !important; }
        }
      `}} />
      <PayslipPreviewDialog
        payslip={previewPayslip}
        open={!!previewPayslip}
        onClose={() => setPreviewPayslip(null)}
      />

      <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('request_advance_title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="advance-amount">{t('advance_amount')}</Label>
              <Input
                id="advance-amount"
                type="number"
                min="0"
                step="0.01"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="advance-reason">{t('advance_reason')}</Label>
              <Textarea
                id="advance-reason"
                value={advanceReason}
                onChange={(e) => setAdvanceReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdvanceOpen(false)}>{tCommon('cancel')}</Button>
            <Button onClick={handleRequestAdvance} disabled={submittingAdvance}>
              {submittingAdvance ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              {tCommon('submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
