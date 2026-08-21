'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import { useTranslations } from 'next-intl'
import {
  CheckCircle2,
  Clock3,
  CalendarDays,
  Wallet,
  Receipt,
  PieChart,
  ShieldCheck,
  CreditCard,
  CalendarClock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FeeDueDateBadge } from '@/components/shared/FeeDueDateBadge'

export interface TimelineFeeItem {
  id: string
  fee_name: string
  due_date: string | null | undefined
  final_amount: number
  amount_paid: number
  balance: number
  status: string
  academic_year: string
}

interface FeePaymentTimelineProps {
  fees: TimelineFeeItem[]
  currencySymbol: string
  /** Where the "Pay Now" / "View Invoices" CTA should navigate. */
  invoicesHref: string
}

type Stage = 'paid' | 'current' | 'overdue' | 'upcoming'

export function FeePaymentTimeline({ fees, currencySymbol, invoicesHref }: FeePaymentTimelineProps) {
  const t = useTranslations('student_billing.timeline')
  const router = useRouter()

  const years = useMemo(() => {
    const set = new Set(fees.map(f => f.academic_year).filter(Boolean))
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [fees])

  const defaultYear = useMemo(() => {
    const withDue = fees.filter(f => f.due_date)
    const nextUnpaid = withDue
      .filter(f => f.status !== 'paid')
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))[0]
    return nextUnpaid?.academic_year || years[0] || ''
  }, [fees, years])

  const [selectedYear, setSelectedYear] = useState<string>(defaultYear)
  const activeYear = selectedYear || defaultYear

  const items = useMemo(() => {
    return fees
      .filter(f => f.academic_year === activeYear && f.due_date)
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
  }, [fees, activeYear])

  const totalFee = items.reduce((s, f) => s + (f.final_amount || 0), 0)
  const paidAmount = items.reduce((s, f) => s + (f.amount_paid || 0), 0)
  const outstanding = Math.max(totalFee - paidAmount, 0)
  const paidPct = totalFee > 0 ? Math.min((paidAmount / totalFee) * 100, 100) : 0

  const nextIndex = items.findIndex(f => f.status !== 'paid')
  const nextItem = nextIndex >= 0 ? items[nextIndex] : null

  function stageOf(item: TimelineFeeItem, index: number): Stage {
    if (item.status === 'paid') return 'paid'
    if (index !== nextIndex) return 'upcoming'
    const diff = item.due_date ? differenceInCalendarDays(parseISO(item.due_date), new Date()) : 0
    return diff < 0 ? 'overdue' : 'current'
  }

  const stageStyles: Record<Stage, { ring: string; bg: string; text: string; icon: ReactNode; badge: ReactNode }> = {
    paid: {
      ring: 'border-green-500',
      bg: 'bg-green-50 dark:bg-green-950/30',
      text: 'text-green-600 dark:text-green-400',
      icon: <CheckCircle2 className="h-5 w-5" />,
      badge: <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{t('badge_paid')}</Badge>,
    },
    current: {
      ring: 'border-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      text: 'text-amber-600 dark:text-amber-400',
      icon: <Clock3 className="h-5 w-5" />,
      badge: <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{t('badge_due_soon')}</Badge>,
    },
    overdue: {
      ring: 'border-red-500',
      bg: 'bg-red-50 dark:bg-red-950/30',
      text: 'text-red-600 dark:text-red-400',
      icon: <Clock3 className="h-5 w-5" />,
      badge: <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{t('badge_overdue')}</Badge>,
    },
    upcoming: {
      ring: 'border-border',
      bg: 'bg-muted/40',
      text: 'text-muted-foreground',
      icon: <CalendarDays className="h-5 w-5" />,
      badge: <Badge variant="outline" className="text-muted-foreground">{t('badge_upcoming')}</Badge>,
    },
  }

  function ordinal(n: number) {
    const key = ['ordinal_1', 'ordinal_2', 'ordinal_3', 'ordinal_4', 'ordinal_5'][n - 1]
    return key ? t(key) : t('ordinal_n', { n })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" /> {t('title')}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            {years.length > 1 && (
              <Select value={activeYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="rounded-lg border px-4 py-2 text-end">
              <p className="text-xs text-muted-foreground">{t('total_fee')}</p>
              <p className="text-lg font-bold">{currencySymbol}{totalFee.toFixed(2)}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-8">
          <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-start gap-3 text-sm text-muted-foreground">
            <Receipt className="h-4 w-4 mt-0.5 shrink-0" />
            {t('info_banner')}
          </div>

          {items.length === 0 ? (
            <div className="text-center py-12">
              <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">{t('no_records')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto pb-2">
              <div className="flex items-start min-w-max px-2">
                {items.map((item, index) => {
                  const stage = stageOf(item, index)
                  const style = stageStyles[stage]
                  return (
                    <div key={item.id} className="flex items-start">
                      <div className="flex flex-col items-center w-36 text-center gap-2">
                        <div>{style.badge}</div>
                        <div className={`relative h-24 w-24 rounded-full border-4 ${style.ring} ${style.bg} flex flex-col items-center justify-center`}>
                          <span className={`absolute -top-1 -end-1 h-7 w-7 rounded-full flex items-center justify-center border-2 border-background ${style.bg} ${style.text}`}>
                            {style.icon}
                          </span>
                          <span className="font-bold text-lg">{ordinal(index + 1)}</span>
                          <span className="text-[11px] text-muted-foreground">{t('installment_word')}</span>
                        </div>
                        <p className="font-semibold text-sm">{currencySymbol}{item.final_amount.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('due_label')}: {item.due_date ? format(parseISO(item.due_date), 'MMM d, yyyy') : '—'}
                        </p>
                        {stage === 'paid' ? (
                          <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30">
                            {t('payment_completed')}
                          </Badge>
                        ) : (
                          <FeeDueDateBadge dueDate={item.due_date} status={item.status} />
                        )}
                      </div>
                      {index < items.length - 1 && (
                        <div
                          className={`w-16 mt-13 ${
                            stage === 'paid'
                              ? 'h-1 rounded-full bg-green-400'
                              : stage === 'overdue'
                                ? 'h-0 border-t-2 border-dashed border-red-300'
                                : 'h-0 border-t-2 border-dashed border-border'
                          }`}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {items.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatTile icon={<Wallet className="h-5 w-5" />} label={t('total_fees')} value={`${currencySymbol}${totalFee.toFixed(2)}`} />
              <StatTile icon={<Receipt className="h-5 w-5" />} label={t('paid_amount')} value={`${currencySymbol}${paidAmount.toFixed(2)}`} valueClass="text-green-600" />
              <StatTile icon={<Wallet className="h-5 w-5" />} label={t('outstanding')} value={`${currencySymbol}${outstanding.toFixed(2)}`} valueClass="text-red-600" />
              <StatTile icon={<PieChart className="h-5 w-5" />} label={t('paid_pct')} value={`${paidPct.toFixed(1)}%`} valueClass="text-green-600" />
              <StatTile icon={<CalendarDays className="h-5 w-5" />} label={t('total_installments')} value={t('installments_count', { count: items.length })} />
            </div>
          )}
        </CardContent>
      </Card>

      {items.length > 0 && (
        nextItem ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-6">
                <p className="font-semibold flex items-center gap-2 mb-4">
                  <CalendarClock className="h-4 w-4" /> {t('next_payment_details')}
                </p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">{t('col_installment')}</p>
                    <p className="font-medium">{ordinal(nextIndex + 1)} {t('installment_word')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">{t('col_due_date')}</p>
                    <p className="font-medium">{nextItem.due_date ? format(parseISO(nextItem.due_date), 'MMM d, yyyy') : '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">{t('col_amount')}</p>
                    <p className="font-medium">{currencySymbol}{nextItem.balance.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-primary/5">
              <CardContent className="p-6 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-8 w-8 text-primary shrink-0" />
                  <p className="text-sm text-muted-foreground">{t('pay_now_hint')}</p>
                </div>
                <button
                  onClick={() => router.push(invoicesHref)}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <CreditCard className="h-4 w-4" /> {t('pay_now')}
                </button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CardContent className="p-6 flex items-center gap-4">
              <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-900 dark:text-green-200">{t('all_paid_title')}</p>
                <p className="text-sm text-green-700 dark:text-green-300">{t('all_paid_desc')}</p>
              </div>
            </CardContent>
          </Card>
        )
      )}
    </div>
  )
}

function StatTile({ icon, label, value, valueClass }: { icon: ReactNode; label: string; value: string; valueClass?: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`font-bold ${valueClass || ''}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
