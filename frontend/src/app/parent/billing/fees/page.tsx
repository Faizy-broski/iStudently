'use client'

import { usePaymentHistory, useChildBillingElements, useFeeStatus, useAllChildrenFees } from '@/hooks/useParentDashboard'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { Receipt, Loader2, AlertCircle, DollarSign, ReceiptText, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { format, parseISO } from 'date-fns'
import { useSchoolSettings } from '@/hooks/useSchoolSettings'

function statusBadge(status: string) {
  switch (status) {
    case 'paid': return <Badge className="bg-green-100 text-green-700">Paid</Badge>
    case 'partial': return <Badge className="bg-yellow-100 text-yellow-700">Partial</Badge>
    case 'overdue': return <Badge className="bg-red-100 text-red-700">Overdue</Badge>
    case 'waived': return <Badge className="bg-blue-100 text-blue-700">Waived</Badge>
    default: return <Badge className="bg-orange-100 text-orange-700">Pending</Badge>
  }
}

function AllChildrenFeesTab() {
  const { childrenFees, isLoading, error } = useAllChildrenFees()
  const { currencySymbol } = useSchoolSettings()

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
        <CardContent className="p-6 flex items-center gap-4">
          <AlertCircle className="h-8 w-8 text-red-600 shrink-0" />
          <div>
            <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading children fees</h3>
            <p className="text-red-700 dark:text-red-300 text-sm">{error.message}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (childrenFees.children.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No children found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Total Due (All Children)</p>
            <p className="text-3xl font-bold text-red-600">{currencySymbol}{childrenFees.totalDue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Total Overdue (All Children)</p>
            <p className="text-3xl font-bold text-orange-600">{currencySymbol}{childrenFees.totalOverdue.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {childrenFees.children.map(child => {
        const childDue = child.fees.filter(f => f.status !== 'paid').reduce((s, f) => s + (f.balance || 0), 0)
        return (
          <Card key={child.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>{child.name || 'Student'}{child.grade_level ? ` — ${child.grade_level}` : ''}</span>
                <span className="text-base font-semibold text-red-600">{currencySymbol}{childDue.toFixed(2)} due</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {child.fees.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4">No fee records found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr className="text-xs text-muted-foreground uppercase">
                        <th className="text-left py-3 pr-4 font-semibold">Due Date</th>
                        <th className="text-right py-3 pr-4 font-semibold">Amount</th>
                        <th className="text-right py-3 pr-4 font-semibold">Paid</th>
                        <th className="text-right py-3 pr-4 font-semibold">Balance</th>
                        <th className="text-center py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {child.fees.map(f => (
                        <tr key={f.id} className="hover:bg-accent/30">
                          <td className="py-3 pr-4 text-muted-foreground">
                            {f.due_date ? format(parseISO(f.due_date), 'MMM d, yyyy') : '—'}
                          </td>
                          <td className="py-3 pr-4 text-right font-medium">{currencySymbol}{(f.final_amount || 0).toFixed(2)}</td>
                          <td className="py-3 pr-4 text-right text-green-600">{currencySymbol}{(f.amount_paid || 0).toFixed(2)}</td>
                          <td className="py-3 pr-4 text-right font-semibold text-red-600">{currencySymbol}{(f.balance || 0).toFixed(2)}</td>
                          <td className="py-3 text-center">{statusBadge(f.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function SelectedChildFeesTab() {
  const { selectedStudent } = useParentDashboard()
  const { fees, isLoading, error } = usePaymentHistory()
  const { billingElements } = useChildBillingElements()
  const { feeStatus } = useFeeStatus()
  const { currencySymbol } = useSchoolSettings()

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
              <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading fees</h3>
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
    <div className="space-y-6">
      {feeStatus && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Due</p>
                <p className="text-2xl font-bold text-red-600">{currencySymbol}{feeStatus.total_due.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Overdue Amount</p>
                <p className="text-2xl font-bold text-orange-600">{currencySymbol}{feeStatus.overdue_amount.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Next Due Date</p>
                <p className="text-2xl font-bold">
                  {feeStatus.next_due_date ? format(parseISO(feeStatus.next_due_date), 'MMM d, yyyy') : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Next Due Amount</p>
                <p className="text-2xl font-bold">
                  {feeStatus.next_due_amount !== undefined ? `${currencySymbol}${feeStatus.next_due_amount.toFixed(2)}` : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Outstanding Balance</p>
            <p className="text-3xl font-bold text-red-600">{currencySymbol}{totalDue.toFixed(2)}</p>
            {overdue.length > 0 && <p className="text-xs text-red-500 mt-1">{overdue.length} overdue</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Total Paid</p>
            <p className="text-3xl font-bold text-green-600">{currencySymbol}{totalPaid.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Total Invoices</p>
            <p className="text-3xl font-bold">{fees.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" /> Fee Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {fees.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
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
                    <tr key={f.id} className="hover:bg-accent/30">
                      <td className="py-3 pr-4">
                        <p className="font-medium">{f.fee_name}</p>
                        <p className="text-xs text-muted-foreground">{f.academic_year}</p>
                      </td>
                      <td className="py-3 pr-4 text-center text-muted-foreground">
                        {f.due_date ? format(parseISO(f.due_date), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="py-3 pr-4 text-right font-medium">{currencySymbol}{f.final_amount.toFixed(2)}</td>
                      <td className="py-3 pr-4 text-right text-green-600">{currencySymbol}{f.amount_paid.toFixed(2)}</td>
                      <td className="py-3 pr-4 text-right font-semibold text-red-600">{currencySymbol}{f.balance.toFixed(2)}</td>
                      <td className="py-3 text-center">{statusBadge(f.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {billingElements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5" /> Additional Charges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-xs text-muted-foreground uppercase">
                    <th className="text-left py-3 pr-4 font-semibold">Charge</th>
                    <th className="text-right py-3 pr-4 font-semibold">Amount</th>
                    <th className="text-right py-3 pr-4 font-semibold">Paid</th>
                    <th className="text-center py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {billingElements.map(el => (
                    <tr key={el.id} className="hover:bg-accent/30">
                      <td className="py-3 pr-4">
                        <p className="font-medium">{el.element_title}</p>
                        {el.category_title && <p className="text-xs text-muted-foreground">{el.category_title}</p>}
                      </td>
                      <td className="py-3 pr-4 text-right font-medium">{currencySymbol}{el.amount.toFixed(2)}</td>
                      <td className="py-3 pr-4 text-right text-green-600">{currencySymbol}{el.amount_paid.toFixed(2)}</td>
                      <td className="py-3 text-center">{statusBadge(el.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function ParentFeesPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Fees</h1>
        <p className="text-muted-foreground mt-1">Fee invoices and payment status</p>
      </div>

      <Tabs defaultValue="selected">
        <TabsList>
          <TabsTrigger value="selected">Selected Child</TabsTrigger>
          <TabsTrigger value="all" className="flex items-center gap-1.5">
            <Users className="h-4 w-4" /> All Children
          </TabsTrigger>
        </TabsList>
        <TabsContent value="selected" className="mt-4">
          <SelectedChildFeesTab />
        </TabsContent>
        <TabsContent value="all" className="mt-4">
          <AllChildrenFeesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
