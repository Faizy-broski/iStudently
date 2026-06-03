'use client'

import { usePaymentHistory } from '@/hooks/useParentDashboard'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { CreditCard, Loader2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format, parseISO } from 'date-fns'

export default function ParentPaymentsPage() {
  const { selectedStudent } = useParentDashboard()
  const { fees, isLoading, error } = usePaymentHistory()

  if (!selectedStudent) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Please select a student from the dashboard</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-6 flex items-center gap-4">
            <AlertCircle className="h-8 w-8 text-red-600 shrink-0" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading payments</h3>
              <p className="text-red-700 dark:text-red-300 text-sm">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Flatten payments from all fee invoices
  const allPayments = fees.flatMap(f =>
    (f.payments || []).map(p => ({ ...p, fee_name: f.fee_name }))
  ).sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''))

  const totalPaid = allPayments.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Payments</h1>
        <p className="text-muted-foreground mt-1">Complete payment history</p>
      </div>

      <Card>
        <CardContent className="p-6 flex items-center gap-4">
          <CreditCard className="h-10 w-10 text-green-500 shrink-0" />
          <div>
            <p className="text-sm text-muted-foreground">Total Payments Made</p>
            <p className="text-3xl font-bold text-green-600">${totalPaid.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{allPayments.length} transaction(s)</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Payment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allPayments.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No payments recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-xs text-muted-foreground uppercase">
                    <th className="text-left py-3 pr-4 font-semibold">Date</th>
                    <th className="text-left py-3 pr-4 font-semibold">Fee</th>
                    <th className="text-left py-3 pr-4 font-semibold">Method</th>
                    <th className="text-left py-3 pr-4 font-semibold">Reference</th>
                    <th className="text-right py-3 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {allPayments.map(p => (
                    <tr key={p.id} className="hover:bg-accent/30">
                      <td className="py-3 pr-4 text-muted-foreground">
                        {p.payment_date ? format(parseISO(p.payment_date), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{(p as any).fee_name || '—'}</td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline">{p.payment_method || '—'}</Badge>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{p.payment_reference || '—'}</td>
                      <td className="py-3 text-right font-semibold text-green-600">${p.amount.toFixed(2)}</td>
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
