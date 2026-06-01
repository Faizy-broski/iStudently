'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { differenceInCalendarDays, parseISO, format } from 'date-fns'
import { CreditCard, ChevronRight, AlertTriangle, Clock, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FeeDueDateBadge } from './FeeDueDateBadge'

interface Fee {
  id: string
  fee_name: string
  due_date?: string | null
  balance: number
  final_amount: number
  status: string
}

interface FinancialWidgetProps {
  fees: Fee[]
  isLoading?: boolean
  feesPageHref: string
}

function urgencyScore(fee: Fee): number {
  if (!fee.due_date) return 9999
  const diff = differenceInCalendarDays(parseISO(fee.due_date), new Date())
  return diff
}

export function FinancialWidget({ fees, isLoading, feesPageHref }: FinancialWidgetProps) {
  const unpaid = useMemo(
    () => fees.filter(f => f.status !== 'paid' && f.balance > 0),
    [fees]
  )

  const sorted = useMemo(
    () => [...unpaid].sort((a, b) => urgencyScore(a) - urgencyScore(b)),
    [unpaid]
  )

  const totalOutstanding = unpaid.reduce((s, f) => s + f.balance, 0)
  const overdueCount = unpaid.filter(f => f.due_date && differenceInCalendarDays(parseISO(f.due_date), new Date()) < 0).length
  const dueTodayCount = unpaid.filter(f => f.due_date && differenceInCalendarDays(parseISO(f.due_date), new Date()) === 0).length

  const formatCurrency = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  if (isLoading) {
    return (
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-orange-500" />
            Financial Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 animate-pulse">
            <div className="h-10 bg-gray-100 rounded-lg" />
            <div className="h-10 bg-gray-100 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (unpaid.length === 0) {
    return (
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-orange-500" />
            Financial Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle className="w-10 h-10 text-green-500 mb-2" />
            <p className="text-sm font-semibold text-green-700">All fees paid</p>
            <p className="text-xs text-muted-foreground mt-1">No outstanding balance</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-none shadow-sm overflow-hidden">
      <CardHeader className="pb-3 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-orange-500" />
            Financial Status
          </CardTitle>
          <Link
            href={feesPageHref}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            View All <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Summary Row */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-orange-50 border border-orange-100">
          <div>
            <p className="text-xs text-orange-700 font-semibold uppercase tracking-wide">Total Outstanding</p>
            <p className="text-2xl font-bold text-orange-600 mt-0.5">{formatCurrency(totalOutstanding)}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {overdueCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                <AlertTriangle className="w-3 h-3" />
                {overdueCount} overdue
              </span>
            )}
            {dueTodayCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-full px-2 py-0.5">
                <Clock className="w-3 h-3" />
                {dueTodayCount} due today
              </span>
            )}
          </div>
        </div>

        {/* Individual fee entries — show up to 4 most urgent */}
        <div className="space-y-2">
          {sorted.slice(0, 4).map(fee => (
            <div
              key={fee.id}
              className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-white hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1 min-w-0 pr-3">
                <p className="text-sm font-medium truncate">{fee.fee_name}</p>
                {fee.due_date && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Due {format(parseISO(fee.due_date), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-sm font-bold text-gray-800">{formatCurrency(fee.balance)}</span>
                <FeeDueDateBadge dueDate={fee.due_date} status={fee.status} />
              </div>
            </div>
          ))}
        </div>

        {sorted.length > 4 && (
          <Link
            href={feesPageHref}
            className="block text-center text-xs text-blue-600 hover:underline font-medium pt-1"
          >
            +{sorted.length - 4} more fee{sorted.length - 4 > 1 ? 's' : ''} — view all
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
