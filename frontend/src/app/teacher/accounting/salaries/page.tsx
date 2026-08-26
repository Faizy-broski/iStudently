'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { getStaffOwnSalaries, getStaffOwnPayments, type AccountingSalary } from '@/lib/api/accounting'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { DownloadCloud, Loader2, Search, Printer, Wallet, Receipt, Scale, Plus, FileText, CheckCircle2 } from 'lucide-react'
import { parseISO, getMonth, getYear } from 'date-fns'
import { formatDateWithPreference } from '@/lib/utils/dateFormat'
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
      toast.error(e.message || 'Could not fetch pay stub.')
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
    <div className="p-4 md:p-6 space-y-6">
      {/* System Standard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent dark:text-white dark:bg-gradient-to-r dark:from-[#57A3CC] dark:to-white">
            {t('title')}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Track assigned monthly salaries, pay stub records, and request salary advances
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setAdvanceOpen(true)}
            className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white shadow-sm gap-2"
          >
            <Plus className="h-4 w-4" />
            {t('request_advance')}
          </Button>
          <Button
            onClick={handlePrint}
            variant="outline"
            size="sm"
            className="gap-2 border-border hover:bg-muted"
          >
            <DownloadCloud className="h-4 w-4" />
            {t('print_export')}
          </Button>
        </div>
      </div>

      {/* Financial Summary Metric Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm border-border bg-card">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {tTotals('total_salaries')}
              </p>
              <p className="text-2xl font-bold text-foreground">
                {currencySymbol}{totalSalaries.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">Cumulative assigned earnings</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-[#022172] dark:text-[#57A3CC]">
              <Wallet className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-card">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {tTotals('less_total_payments')}
              </p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {currencySymbol}{totalPayments.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">Disbursed staff payments</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Receipt className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-card">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {tTotals('balance')}
              </p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {currencySymbol}{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <div className="flex items-center gap-1.5 pt-0.5">
                <Badge variant="outline" className={balance <= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-purple-50 text-purple-700 border-purple-200'}>
                  {balance <= 0 ? 'Fully Paid' : 'Remaining Balance'}
                </Badge>
              </div>
            </div>
            <div className="h-11 w-11 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Scale className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar Card */}
      <Card className="shadow-sm border-border">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#022172] dark:text-[#57A3CC]" />
            <span>{t('found_count', { count: filteredSalaries.length })}</span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={tCommon('search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
        </CardContent>
      </Card>

      {/* Salaries Table */}
      <Card className="shadow-sm border-border overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gradient-to-r from-[#57A3CC]/10 to-[#022172]/10">
              <TableRow>
                <TableHead className="font-semibold text-foreground">{t('col_salary')}</TableHead>
                <TableHead className="font-semibold text-foreground">{t('col_amount')}</TableHead>
                <TableHead className="font-semibold text-foreground">{t('col_assigned')}</TableHead>
                <TableHead className="font-semibold text-foreground">{t('col_due')}</TableHead>
                <TableHead className="font-semibold text-foreground">{t('col_comment')}</TableHead>
                <TableHead className="font-semibold text-foreground">{t('col_file_attached')}</TableHead>
                <TableHead className="font-semibold text-foreground text-right">{t('col_actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingSalaries ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredSalaries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <Wallet className="h-8 w-8 text-muted-foreground/50 mb-1" />
                      <p className="font-medium">{t('no_salaries')}</p>
                      <p className="text-xs text-muted-foreground">No salary assignments found for your account.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredSalaries.map((salary) => (
                  <TableRow key={salary.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium text-foreground">{salary.title || 'Salary Assignment'}</TableCell>
                    <TableCell className="font-semibold text-[#022172] dark:text-[#57A3CC]">
                      {currencySymbol}{Number(salary.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateWithPreference(salary.assigned_date)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {salary.due_date ? formatDateWithPreference(salary.due_date) : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{salary.comments || '-'}</TableCell>
                    <TableCell>
                      {salary.file_attached ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> {tCommon('yes')}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePrintPayStub(salary)}
                        title={t('print_pay_stub')}
                        disabled={printingId === salary.id}
                      >
                        {printingId === salary.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-[#022172]" />
                        ) : (
                          <Printer className="h-4 w-4 text-[#022172] dark:text-[#57A3CC]" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Summary Footer Card */}
      <Card className="shadow-sm border-border max-w-md ml-auto bg-muted/20">
        <CardContent className="p-4 space-y-2 text-sm">
          <div className="flex justify-between items-center text-muted-foreground">
            <span>{tTotals('total_salaries')}</span>
            <span className="font-medium text-foreground">
              {currencySymbol}{totalSalaries.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between items-center text-muted-foreground">
            <span>{tTotals('less_total_payments')}</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              -{currencySymbol}{totalPayments.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="border-t border-border pt-2 flex justify-between items-center font-bold text-base">
            <span>{tTotals('balance')}</span>
            <span className="text-purple-600 dark:text-purple-400">
              {currencySymbol}{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Print Native Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
           body * { visibility: hidden; }
           .p-4, .p-6 { visibility: visible; position: absolute; left: 0; top: 0; width: 100%; }
           .p-4 *, .p-6 * { visibility: visible; }
           button, input, .no-print { display: none !important; }
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
            <Button onClick={handleRequestAdvance} disabled={submittingAdvance} className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white">
              {submittingAdvance ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              {tCommon('submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
