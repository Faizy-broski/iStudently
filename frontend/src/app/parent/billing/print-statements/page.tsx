'use client'

import { usePaymentHistory } from '@/hooks/useParentDashboard'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { FileText, Loader2, AlertCircle, DollarSign, Printer } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format, parseISO } from 'date-fns'

function statusBadge(status: string) {
  switch (status) {
    case 'paid': return <Badge className="bg-green-100 text-green-700">Paid</Badge>
    case 'partial': return <Badge className="bg-yellow-100 text-yellow-700">Partial</Badge>
    case 'overdue': return <Badge className="bg-red-100 text-red-700">Overdue</Badge>
    default: return <Badge className="bg-orange-100 text-orange-700">Pending</Badge>
  }
}

export default function ParentPrintStatementsPage() {
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
              <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading statement</h3>
              <p className="text-red-700 dark:text-red-300 text-sm">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalCharged = fees.reduce((s, f) => s + f.final_amount, 0)
  const totalPaid = fees.reduce((s, f) => s + f.amount_paid, 0)
  const totalBalance = fees.reduce((s, f) => s + f.balance, 0)
  const allPayments = fees.flatMap(f =>
    (f.payments || []).map(p => ({ ...p, fee_name: f.fee_name }))
  ).sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-3xl font-bold">Print Statement</h1>
          <p className="text-muted-foreground mt-1">Complete billing statement</p>
        </div>
        <Button onClick={() => window.print()} variant="outline" className="gap-2">
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">Billing Statement</h1>
        <p className="text-sm text-gray-500">{format(new Date(), 'MMMM d, yyyy')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Total Charged</p>
            <p className="text-3xl font-bold">${totalCharged.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Total Paid</p>
            <p className="text-3xl font-bold text-green-600">${totalPaid.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Outstanding Balance</p>
            <p className={`text-3xl font-bold ${totalBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ${totalBalance.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Fee Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {fees.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No fee records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-xs text-muted-foreground uppercase">
                    <th className="text-left py-3 pr-4 font-semibold">Fee</th>
                    <th className="text-center py-3 pr-4 font-semibold">Due Date</th>
                    <th className="text-right py-3 pr-4 font-semibold">Amount</th>
                    <th className="text-right py-3 pr-4 font-semibold">Paid</th>
                    <th className="text-right py-3 pr-4 font-semibold">Balance</th>
                    <th className="text-center py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {fees.map(f => (
                    <tr key={f.id}>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{f.fee_name}</p>
                        <p className="text-xs text-muted-foreground">{f.academic_year}</p>
                      </td>
                      <td className="py-3 pr-4 text-center text-muted-foreground">
                        {f.due_date ? format(parseISO(f.due_date), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="py-3 pr-4 text-right font-medium">${f.final_amount.toFixed(2)}</td>
                      <td className="py-3 pr-4 text-right text-green-600">${f.amount_paid.toFixed(2)}</td>
                      <td className="py-3 pr-4 text-right font-semibold text-red-600">${f.balance.toFixed(2)}</td>
                      <td className="py-3 text-center">{statusBadge(f.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" /> Payment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allPayments.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
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
                    <tr key={p.id}>
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
