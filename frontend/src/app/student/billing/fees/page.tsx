'use client'

import { useStudentFees } from '@/hooks/useStudentDashboard'
import { Receipt, Loader2, AlertCircle, DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format, parseISO } from 'date-fns'
import { useTranslations } from 'next-intl'

export default function StudentFeesPage() {
  const { fees, isLoading, error } = useStudentFees()
  const t = useTranslations('student_billing.fees')

  function statusBadge(status: string) {
    switch (status) {
      case 'paid': return <Badge className="bg-green-100 text-green-700">{t('status_paid')}</Badge>
      case 'partial': return <Badge className="bg-yellow-100 text-yellow-700">{t('status_partial')}</Badge>
      case 'overdue': return <Badge className="bg-red-100 text-red-700">{t('status_overdue')}</Badge>
      default: return <Badge className="bg-orange-100 text-orange-700">{t('status_pending')}</Badge>
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-6 flex items-center gap-4">
            <AlertCircle className="h-8 w-8 text-red-600 shrink-0" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-200">{t('error_loading')}</h3>
              <p className="text-red-700 dark:text-red-300 text-sm">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalDue = fees.filter(f => f.status !== 'paid').reduce((s, f) => s + f.balance, 0)
  const totalPaid = fees.reduce((s, f) => s + f.amount_paid, 0)
  const overdue = fees.filter(f => f.status === 'overdue')

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">{t('total_outstanding')}</p>
            <p className="text-3xl font-bold text-red-600">${totalDue.toFixed(2)}</p>
            {overdue.length > 0 && <p className="text-xs text-red-500 mt-1">{t('overdue_count', { count: overdue.length })}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">{t('total_paid')}</p>
            <p className="text-3xl font-bold text-green-600">${totalPaid.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">{t('total_invoices')}</p>
            <p className="text-3xl font-bold">{fees.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" /> {t('fee_invoices')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {fees.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">{t('no_records')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-xs text-muted-foreground uppercase">
                    <th className="text-start py-3 pe-4 font-semibold">{t('col_fee')}</th>
                    <th className="text-center py-3 pe-4 font-semibold">{t('col_due_date')}</th>
                    <th className="text-end py-3 pe-4 font-semibold">{t('col_amount')}</th>
                    <th className="text-end py-3 pe-4 font-semibold">{t('col_paid')}</th>
                    <th className="text-end py-3 pe-4 font-semibold">{t('col_balance')}</th>
                    <th className="text-center py-3 font-semibold">{t('col_status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {fees.map(f => (
                    <tr key={f.id} className="hover:bg-accent/30">
                      <td className="py-3 pe-4">
                        <p className="font-medium">{f.fee_name}</p>
                        <p className="text-xs text-muted-foreground">{f.academic_year}</p>
                      </td>
                      <td className="py-3 pe-4 text-center text-muted-foreground">
                        {f.due_date ? format(parseISO(f.due_date), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="py-3 pe-4 text-end font-medium">${f.final_amount.toFixed(2)}</td>
                      <td className="py-3 pe-4 text-end text-green-600">${f.amount_paid.toFixed(2)}</td>
                      <td className="py-3 pe-4 text-end font-semibold text-red-600">${f.balance.toFixed(2)}</td>
                      <td className="py-3 text-center">{statusBadge(f.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
