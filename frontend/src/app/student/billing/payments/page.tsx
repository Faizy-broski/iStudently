'use client'

import { useStudentPaymentHistory } from '@/hooks/useStudentDashboard'
import { CreditCard, Loader2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format, parseISO } from 'date-fns'
import { useTranslations } from 'next-intl'

export default function StudentPaymentsPage() {
  const { payments, isLoading, error } = useStudentPaymentHistory()
  const t = useTranslations('student_billing.payments')

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

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      <Card>
        <CardContent className="p-6 flex items-center gap-4">
          <CreditCard className="h-10 w-10 text-green-500 shrink-0" />
          <div>
            <p className="text-sm text-muted-foreground">{t('total_payments_made')}</p>
            <p className="text-3xl font-bold text-green-600">${totalPaid.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{t('transactions_count', { count: payments.length })}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> {t('payment_history')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">{t('no_payments')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-xs text-muted-foreground uppercase">
                    <th className="text-start py-3 pe-4 font-semibold">{t('col_date')}</th>
                    <th className="text-start py-3 pe-4 font-semibold">{t('col_method')}</th>
                    <th className="text-start py-3 pe-4 font-semibold">{t('col_reference')}</th>
                    <th className="text-start py-3 pe-4 font-semibold">{t('col_received_by')}</th>
                    <th className="text-end py-3 font-semibold">{t('col_amount')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payments.map(p => (
                    <tr key={p.id} className="hover:bg-accent/30">
                      <td className="py-3 pe-4 text-muted-foreground">
                        {p.payment_date ? format(parseISO(p.payment_date), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="py-3 pe-4">
                        <Badge variant="outline">{p.payment_method || '—'}</Badge>
                      </td>
                      <td className="py-3 pe-4 text-muted-foreground">{p.payment_reference || '—'}</td>
                      <td className="py-3 pe-4 text-muted-foreground">{p.received_by || '—'}</td>
                      <td className="py-3 text-end font-semibold text-green-600">${p.amount.toFixed(2)}</td>
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
