'use client'

import { useState, useMemo } from 'react'
import { useCampus } from '@/context/CampusContext'
import { useAcademic } from '@/context/AcademicContext'
import * as accountingApi from '@/lib/api/accounting'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { IconLoader, IconPrinter } from '@tabler/icons-react'
import useSWR from 'swr'
import { format, parse } from 'date-fns'
import { useTranslations } from 'next-intl'
import { useSchoolSettings } from '@/hooks/useSchoolSettings'

const MONTHS = [
    { value: '01', monthKey: '0' },
    { value: '02', monthKey: '1' },
    { value: '03', monthKey: '2' },
    { value: '04', monthKey: '3' },
    { value: '05', monthKey: '4' },
    { value: '06', monthKey: '5' },
    { value: '07', monthKey: '6' },
    { value: '08', monthKey: '7' },
    { value: '09', monthKey: '8' },
    { value: '10', monthKey: '9' },
    { value: '11', monthKey: '10' },
    { value: '12', monthKey: '11' },
]

const getDaysInMonth = (month: string, year: string) => {
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate()
    return Array.from({ length: daysInMonth }, (_, i) => ({
        value: String(i + 1).padStart(2, '0'),
        label: String(i + 1)
    }))
}

const getYears = () => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 10 }, (_, i) => ({
        value: String(currentYear - 5 + i),
        label: String(currentYear - 5 + i)
    }))
}

interface Transaction {
    id: string
    type: 'income' | 'expense' | 'staff_payment'
    title: string
    amount: number
    date: string
    category?: string
    staff_name?: string
}

export default function DailyTransactionsPage() {
    const t = useTranslations('admin.accounting.daily_transactions')
    const tCommon = useTranslations('common')
    const { selectedCampus, loading: campusLoading } = useCampus() || {}
    const { currentAcademicYear } = useAcademic()
    const campusId = selectedCampus?.id
    const academicYear = currentAcademicYear?.name || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
    const { formatCurrency } = useSchoolSettings()

    const today = new Date()
    const [startMonth, setStartMonth] = useState('N/A')
    const [startDay, setStartDay] = useState('N/A')
    const [startYear, setStartYear] = useState('N/A')
    const [endMonth, setEndMonth] = useState(String(today.getMonth() + 1).padStart(2, '0'))
    const [endDay, setEndDay] = useState(String(today.getDate()).padStart(2, '0'))
    const [endYear, setEndYear] = useState(String(today.getFullYear()))
    const [appliedFilters, setAppliedFilters] = useState<{ startDate?: string; endDate?: string }>({
        endDate: format(today, 'yyyy-MM-dd')
    })

    const { data: incomes, isLoading: loadingIncomes } = useSWR(
        campusId ? ['accounting-incomes-report', campusId, academicYear, appliedFilters.startDate, appliedFilters.endDate] : null,
        () => accountingApi.getIncomes(campusId!, academicYear, appliedFilters.startDate, appliedFilters.endDate),
        { revalidateOnFocus: false }
    )

    const { data: expenses, isLoading: loadingExpenses } = useSWR(
        campusId ? ['accounting-expenses-report', campusId, academicYear, appliedFilters.startDate, appliedFilters.endDate] : null,
        () => accountingApi.getExpenses(campusId!, academicYear, appliedFilters.startDate, appliedFilters.endDate),
        { revalidateOnFocus: false }
    )

    const { data: staffPayments, isLoading: loadingStaffPayments } = useSWR(
        campusId ? ['accounting-staff-payments-report', campusId, academicYear, appliedFilters.startDate, appliedFilters.endDate] : null,
        () => accountingApi.getStaffPayments(campusId!, academicYear, appliedFilters.startDate, appliedFilters.endDate),
        { revalidateOnFocus: false }
    )

    const { data: totals } = useSWR(
        campusId ? ['accounting-totals-report', campusId, academicYear, appliedFilters.startDate, appliedFilters.endDate] : null,
        () => accountingApi.getAccountingTotals(campusId!, academicYear, appliedFilters.startDate, appliedFilters.endDate),
        { revalidateOnFocus: false }
    )

    const isLoading = loadingIncomes || loadingExpenses || loadingStaffPayments

    const transactionsByDate = useMemo(() => {
        const allTransactions: Transaction[] = []

        incomes?.forEach(income => {
            allTransactions.push({
                id: income.id,
                type: 'income',
                title: income.title,
                amount: income.amount,
                date: income.income_date,
                category: income.category?.name
            })
        })

        expenses?.forEach(expense => {
            allTransactions.push({
                id: expense.id,
                type: 'expense',
                title: expense.title,
                amount: expense.amount,
                date: expense.payment_date,
                category: expense.category?.name
            })
        })

        staffPayments?.forEach(payment => {
            allTransactions.push({
                id: payment.id,
                type: 'staff_payment',
                title: payment.title,
                amount: payment.amount,
                date: payment.payment_date,
                staff_name: payment.staff?.profiles ? `${payment.staff.profiles.first_name} ${payment.staff.profiles.last_name}` : undefined
            })
        })

        allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

        const grouped: Record<string, Transaction[]> = {}
        allTransactions.forEach(tx => {
            if (!grouped[tx.date]) grouped[tx.date] = []
            grouped[tx.date].push(tx)
        })

        return grouped
    }, [incomes, expenses, staffPayments])

    const handleApplyFilters = () => {
        let startDate: string | undefined
        let endDate: string | undefined
        if (startYear !== 'N/A' && startMonth !== 'N/A' && startDay !== 'N/A') {
            startDate = `${startYear}-${startMonth}-${startDay}`
        }
        if (endYear !== 'N/A' && endMonth !== 'N/A' && endDay !== 'N/A') {
            endDate = `${endYear}-${endMonth}-${endDay}`
        }
        setAppliedFilters({ startDate, endDate })
    }

    const formatDateDisplay = (dateStr: string) => {
        const date = parse(dateStr, 'yyyy-MM-dd', new Date())
        return format(date, 'MMMM d, yyyy')
    }

    const getTypeLabel = (type: string) => {
        if (type === 'income') return t('type_income')
        if (type === 'expense') return t('type_expense')
        if (type === 'staff_payment') return t('type_staff_payment')
        return type
    }

    const getTypeColor = (type: string) => {
        if (type === 'income') return 'text-green-600'
        if (type === 'expense') return 'text-red-600'
        if (type === 'staff_payment') return 'text-orange-600'
        return ''
    }

    if (campusLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <IconLoader className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!selectedCampus) {
        return (
            <div className="container mx-auto py-6">
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-muted-foreground text-center">{t('select_campus')}</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const dateKeys = Object.keys(transactionsByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
                    <p className="text-muted-foreground">{t('subtitle', { campus: selectedCampus.name })}</p>
                </div>
                <Button onClick={() => window.print()} variant="outline">
                    <IconPrinter className="h-4 w-4 mr-2" />
                    {tCommon('print')}
                </Button>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-4 flex-wrap">
                        <span className="font-medium">{t('period')}</span>
                        <div className="flex items-center gap-2">
                            <Select value={startMonth} onValueChange={setStartMonth}>
                                <SelectTrigger className="w-28">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="N/A">N/A</SelectItem>
                                    {MONTHS.map(m => (
                                        <SelectItem key={m.value} value={m.value}>{tCommon(`months.${m.monthKey}`)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={startDay} onValueChange={setStartDay}>
                                <SelectTrigger className="w-20">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="N/A">N/A</SelectItem>
                                    {getDaysInMonth(startMonth === 'N/A' ? '01' : startMonth, startYear === 'N/A' ? String(today.getFullYear()) : startYear).map(d => (
                                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={startYear} onValueChange={setStartYear}>
                                <SelectTrigger className="w-24">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="N/A">N/A</SelectItem>
                                    {getYears().map(y => (
                                        <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <span>{tCommon('to')}</span>
                        <div className="flex items-center gap-2">
                            <Select value={endMonth} onValueChange={setEndMonth}>
                                <SelectTrigger className="w-28">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MONTHS.map(m => (
                                        <SelectItem key={m.value} value={m.value}>{tCommon(`months.${m.monthKey}`)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={endDay} onValueChange={setEndDay}>
                                <SelectTrigger className="w-20">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {getDaysInMonth(endMonth, endYear).map(d => (
                                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={endYear} onValueChange={setEndYear}>
                                <SelectTrigger className="w-24">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {getYears().map(y => (
                                        <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleApplyFilters} variant="default" className="bg-[#3d8fb5] hover:bg-[#357ea0]">
                            {tCommon('view')}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="pt-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : dateKeys.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">{t('empty')}</p>
                    ) : (
                        <div className="space-y-6">
                            {dateKeys.map(dateKey => {
                                const transactions = transactionsByDate[dateKey]
                                const dayIncomes = transactions.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0)
                                const dayExpenses = transactions.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0)
                                const dayStaffPayments = transactions.filter(tx => tx.type === 'staff_payment').reduce((sum, tx) => sum + tx.amount, 0)
                                const dayBalance = dayIncomes - dayExpenses - dayStaffPayments

                                return (
                                    <div key={dateKey} className="border rounded-lg overflow-hidden">
                                        <div className="bg-muted px-4 py-2 font-semibold flex justify-between items-center">
                                            <span>{formatDateDisplay(dateKey)}</span>
                                            <span className={dayBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                {formatCurrency(dayBalance)}
                                            </span>
                                        </div>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>{t('col_type')}</TableHead>
                                                    <TableHead>{t('col_description')}</TableHead>
                                                    <TableHead>{t('col_category_staff')}</TableHead>
                                                    <TableHead className="text-right">{t('col_amount')}</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {transactions.map(tx => (
                                                    <TableRow key={`${tx.type}-${tx.id}`}>
                                                        <TableCell>
                                                            <span className={getTypeColor(tx.type)}>{getTypeLabel(tx.type)}</span>
                                                        </TableCell>
                                                        <TableCell>{tx.title}</TableCell>
                                                        <TableCell>{tx.category || tx.staff_name || '-'}</TableCell>
                                                        <TableCell className={`text-right ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                                            {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        <div className="bg-muted/50 px-4 py-2 text-sm flex justify-between">
                                            <span>
                                                {t('day_income')}: {formatCurrency(dayIncomes)} |{' '}
                                                {t('day_expenses')}: {formatCurrency(dayExpenses)} |{' '}
                                                {t('day_staff')}: {formatCurrency(dayStaffPayments)}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('summary_title')}</CardTitle>
                    <CardDescription>{t('summary_desc')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="border-b pb-4">
                            <div className="flex justify-between text-sm">
                                <span>{t('total_incomes')}</span>
                                <span className="text-green-600">{formatCurrency(totals?.total_incomes || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>{t('less_expenses')}</span>
                                <span className="text-red-600">{formatCurrency(totals?.total_expenses || 0)}</span>
                            </div>
                            <div className="flex justify-between font-bold">
                                <span>{t('balance')}</span>
                                <span className={(totals?.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    {formatCurrency(totals?.balance || 0)}
                                </span>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm">
                                <span>{t('total_incomes')}</span>
                                <span className="text-green-600">{formatCurrency(totals?.total_incomes || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>{t('plus_student_payments')}</span>
                                <span className="text-green-600">{formatCurrency(totals?.total_student_payments || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>{t('less_expenses')}</span>
                                <span className="text-red-600">{formatCurrency(totals?.total_expenses || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>{t('plus_staff_payments')}</span>
                                <span className="text-red-600">{formatCurrency(totals?.total_staff_payments || 0)}</span>
                            </div>
                            <div className="flex justify-between font-bold">
                                <span>{t('general_balance')}</span>
                                <span className={(totals?.general_balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    {formatCurrency(totals?.general_balance || 0)}
                                </span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
