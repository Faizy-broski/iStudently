'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { getStaffOwnSalaries, getStaffOwnPayments } from '@/lib/api/accounting'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { DownloadCloud, Loader2, Search, CreditCard, Wallet, Receipt, Scale, ArrowUpRight, CheckCircle2 } from 'lucide-react'
import { formatDateWithPreference } from '@/lib/utils/dateFormat'
import { useSchoolSettings } from '@/hooks/useSchoolSettings'

export default function TeacherStaffPaymentsPage() {
  const t = useTranslations('teacherPortal.accounting.staff_payments')
  const tTotals = useTranslations('teacherPortal.accounting.totals')
  const tCommon = useTranslations('common')
  const { currencySymbol } = useSchoolSettings()
  const [searchQuery, setSearchQuery] = useState('')

  const { data: salariesRes } = useSWR(
    'teacher-own-salaries-totals',
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

  // Filter logic
  const filteredPayments = payments.filter(p =>
    p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.comments?.toLowerCase().includes(searchQuery.toLowerCase())
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
            View payment disbursements, transaction history, and balance breakdown
          </p>
        </div>
        <div className="flex items-center gap-2">
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
              <p className="text-xs text-muted-foreground">Cumulative assigned salaries</p>
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
              <p className="text-xs text-muted-foreground">Total payments received to date</p>
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
            <CreditCard className="h-4 w-4 text-[#022172] dark:text-[#57A3CC]" />
            <span>
              {filteredPayments.length === 0
                ? t('no_payments')
                : t('found_count', { count: filteredPayments.length })}
            </span>
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

      {/* Staff Payments Table */}
      <Card className="shadow-sm border-border overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gradient-to-r from-[#57A3CC]/10 to-[#022172]/10">
              <TableRow>
                <TableHead className="font-semibold text-foreground">{t('col_payment')}</TableHead>
                <TableHead className="font-semibold text-foreground">{t('col_amount')}</TableHead>
                <TableHead className="font-semibold text-foreground">{t('col_date')}</TableHead>
                <TableHead className="font-semibold text-foreground">{t('col_comment')}</TableHead>
                <TableHead className="font-semibold text-foreground text-right">{t('col_file_attached')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingPayments ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <CreditCard className="h-8 w-8 text-muted-foreground/50 mb-1" />
                      <p className="font-medium">{t('no_payments')}</p>
                      <p className="text-xs text-muted-foreground">No payment records found for your account.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => (
                  <TableRow key={payment.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium text-foreground">{payment.title || 'Staff Payment'}</TableCell>
                    <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {currencySymbol}{Number(payment.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateWithPreference(payment.payment_date)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{payment.comments || '-'}</TableCell>
                    <TableCell className="text-right">
                      {payment.file_attached ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> {tCommon('yes')}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
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
    </div>
  )
}
