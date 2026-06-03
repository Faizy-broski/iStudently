'use client'

import { useState, useMemo } from 'react'
import { useStudentPaymentHistory } from '@/hooks/useStudentDashboard'
import { DollarSign, Loader2, AlertCircle, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format, parseISO } from 'date-fns'
import { useTranslations } from 'next-intl'

export default function DailyTransactionsPage() {
  const { payments, isLoading, error } = useStudentPaymentHistory()
  const t = useTranslations('student_billing.daily_transactions')
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  // Localised month names via Intl
  const MONTHS = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'long' })
  )

  const filtered = useMemo(() => {
    return payments.filter(p => {
      if (!p.payment_date) return false
      const d = parseISO(p.payment_date)
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
    })
  }, [payments, selectedMonth, selectedYear])

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
              <h3 className="font-semibold text-red-900 dark:text-red-200">{t('error_loading')}</h3>
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
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
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
            <p className="text-sm text-muted-foreground">{t('monthly_total', { month: MONTHS[selectedMonth], year: selectedYear })}</p>
            <p className="text-3xl font-bold text-green-600">${monthTotal.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{t('transactions_count', { count: filtered.length })}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" /> {t('transactions_card_title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {byDay.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">{t('no_transactions', { month: MONTHS[selectedMonth], year: selectedYear })}</p>
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
                          <Badge variant="outline">{p.payment_method || 'â€”'}</Badge>
                          <span className="text-muted-foreground">{p.payment_reference || t('no_reference')}</span>
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
