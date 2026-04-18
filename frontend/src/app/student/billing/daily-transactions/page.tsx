'use client'

import { useState, useMemo } from 'react'
import { useStudentPaymentHistory } from '@/hooks/useStudentDashboard'
import { DollarSign, Loader2, AlertCircle, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format, parseISO, isSameDay } from 'date-fns'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function DailyTransactionsPage() {
  const { payments, isLoading, error } = useStudentPaymentHistory()
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  const filtered = useMemo(() => {
    return payments.filter(p => {
      if (!p.payment_date) return false
      const d = parseISO(p.payment_date)
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
    })
  }, [payments, selectedMonth, selectedYear])

  // Group by day
  const byDay = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    for (const p of filtered) {
      if (!p.payment_date) continue
      const key = p.payment_date.slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [filtered])

  if (isLoading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-6 flex items-center gap-4">
            <AlertCircle className="h-8 w-8 text-red-600 shrink-0" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading transactions</h3>
              <p className="text-red-700 dark:text-red-300 text-sm">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const monthTotal = filtered.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Daily Transactions</h1>
          <p className="text-muted-foreground mt-1">Payment transactions grouped by day</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedMonth.toString()} onValueChange={v => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[now.getFullYear() - 1, now.getFullYear()].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 flex items-center gap-4">
          <DollarSign className="h-10 w-10 text-green-500 shrink-0" />
          <div>
            <p className="text-sm text-muted-foreground">{MONTHS[selectedMonth]} {selectedYear} — Total</p>
            <p className="text-3xl font-bold text-green-600">${monthTotal.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{filtered.length} transaction(s)</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" /> Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {byDay.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No transactions in {MONTHS[selectedMonth]} {selectedYear}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {byDay.map(([day, items]) => (
                <div key={day}>
                  <p className="text-sm font-semibold text-muted-foreground mb-2">
                    {format(parseISO(day), 'EEEE, MMMM d, yyyy')}
                  </p>
                  <div className="space-y-1">
                    {items.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border bg-card text-sm">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{p.payment_method || '—'}</Badge>
                          <span className="text-muted-foreground">{p.payment_reference || 'No reference'}</span>
                        </div>
                        <span className="font-semibold text-green-600">${p.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
