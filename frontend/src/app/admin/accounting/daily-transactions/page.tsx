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

const MONTHS = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
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
    const { selectedCampus, loading: campusLoading } = useCampus() || {}
    const { currentAcademicYear } = useAcademic()
    const campusId = selectedCampus?.id
    const academicYear = currentAcademicYear?.name || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`

    // Date filter state
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

    // Fetch all data
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

    // Combine and group transactions by date
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

        // Sort by date descending
        allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

        // Group by date
        const grouped: Record<string, Transaction[]> = {}
        allTransactions.forEach(tx => {
            const dateKey = tx.date
            if (!grouped[dateKey]) grouped[dateKey] = []
            grouped[dateKey].push(tx)
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

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount)
    }

    const formatDateDisplay = (dateStr: string) => {
        const date = parse(dateStr, 'yyyy-MM-dd', new Date())
        return format(date, 'MMMM d, yyyy')
    }

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'income': return 'Income'
            case 'expense': return 'Expense'
            case 'staff_payment': return 'Staff Payment'
            default: return type
        }
    }

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'income': return 'text-green-600'
            case 'expense': return 'text-red-600'
            case 'staff_payment': return 'text-orange-600'
            default: return ''
        }
    }

    const handlePrint = () => {
        window.print()
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
                        <p className="text-muted-foreground text-center">Please select a campus to view daily transactions.</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const dateKeys = Object.keys(transactionsByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Daily Transactions</h1>
                    <p className="text-muted-foreground">
                        View all financial transactions grouped by day • {selectedCampus.name}
                    </p>
                </div>
                <Button onClick={handlePrint} variant="outline">
                    <IconPrinter className="h-4 w-4 mr-2" />
                    Print
                </Button>
            </div>

            {/* Date Filter */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-4 flex-wrap">
                        <span className="font-medium">Timeframe:</span>
                        <div className="flex items-center gap-2">
                            <Select value={startMonth} onValueChange={setStartMonth}>
                                <SelectTrigger className="w-28">
                                    <SelectValue placeholder="Month" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="N/A">N/A</SelectItem>
                                    {MONTHS.map(m => (
                                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={startDay} onValueChange={setStartDay}>
                                <SelectTrigger className="w-20">
                                    <SelectValue placeholder="Day" />
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
                                    <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="N/A">N/A</SelectItem>
                                    {getYears().map(y => (
                                        <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <span>to</span>
                        <div className="flex items-center gap-2">
                            <Select value={endMonth} onValueChange={setEndMonth}>
                                <SelectTrigger className="w-28">
                                    <SelectValue placeholder="Month" />
                                </SelectTrigger>
                                <SelectContent>
                                    {MONTHS.map(m => (
                                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={endDay} onValueChange={setEndDay}>
                                <SelectTrigger className="w-20">
                                    <SelectValue placeholder="Day" />
                                </SelectTrigger>
                                <SelectContent>
                                    {getDaysInMonth(endMonth, endYear).map(d => (
                                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={endYear} onValueChange={setEndYear}>
                                <SelectTrigger className="w-24">
                                    <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {getYears().map(y => (
                                        <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleApplyFilters} variant="default" className="bg-[#3d8fb5] hover:bg-[#357ea0]">
                            GO
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Transactions by Day */}
            <Card>
                <CardContent className="pt-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : dateKeys.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No transactions found for the selected period.</p>
                    ) : (
                        <div className="space-y-6">
                            {dateKeys.map(dateKey => {
                                const transactions = transactionsByDate[dateKey]
                                const dayIncomes = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
                                const dayExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
                                const dayStaffPayments = transactions.filter(t => t.type === 'staff_payment').reduce((sum, t) => sum + t.amount, 0)
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
                                                    <TableHead>TYPE</TableHead>
                                                    <TableHead>DESCRIPTION</TableHead>
                                                    <TableHead>CATEGORY / STAFF</TableHead>
                                                    <TableHead className="text-right">AMOUNT</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {transactions.map(tx => (
                                                    <TableRow key={`${tx.type}-${tx.id}`}>
                                                        <TableCell>
                                                            <span className={getTypeColor(tx.type)}>
                                                                {getTypeLabel(tx.type)}
                                                            </span>
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
                                                Incomes: {formatCurrency(dayIncomes)} | 
                                                Expenses: {formatCurrency(dayExpenses)} | 
                                                Staff Payments: {formatCurrency(dayStaffPayments)}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Totals Summary */}
            <Card>
                <CardHeader>
                    <CardTitle>Period Summary</CardTitle>
                    <CardDescription>Totals for the selected date range</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="border-b pb-4">
                            <div className="flex justify-between text-sm">
                                <span>Total from Incomes:</span>
                                <span className="text-green-600">{formatCurrency(totals?.total_incomes || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>Less: Total from Expenses:</span>
                                <span className="text-red-600">{formatCurrency(totals?.total_expenses || 0)}</span>
                            </div>
                            <div className="flex justify-between font-bold">
                                <span>Balance:</span>
                                <span className={(totals?.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    {formatCurrency(totals?.balance || 0)}
                                </span>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm">
                                <span>Total from Incomes:</span>
                                <span className="text-green-600">{formatCurrency(totals?.total_incomes || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>&amp; Total from Student Payments:</span>
                                <span className="text-green-600">{formatCurrency(totals?.total_student_payments || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>Less: Total from Expenses:</span>
                                <span className="text-red-600">{formatCurrency(totals?.total_expenses || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>&amp; Total from Staff Payments:</span>
                                <span className="text-red-600">{formatCurrency(totals?.total_staff_payments || 0)}</span>
                            </div>
                            <div className="flex justify-between font-bold">
                                <span>General Balance:</span>
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
