'use client'

import { useState, useEffect } from 'react'
import { useCampus } from '@/context/CampusContext'
import { useAcademic } from '@/context/AcademicContext'
import * as accountingApi from '@/lib/api/accounting'
import { getSchoolSettings, PAYMENT_METHOD_OPTIONS, type PaymentMethodOption } from '@/lib/api/school-settings'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { IconPlus, IconTrash, IconLoader, IconDeviceFloppy } from '@tabler/icons-react'
import { toast } from 'sonner'
import useSWR from 'swr'
import { format, parse } from 'date-fns'
import { useTranslations } from 'next-intl'

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

interface ExpenseRow {
    id?: string
    title: string
    category_id: string
    amount: string
    payment_date: string
    comments: string
    payment_method: PaymentMethodOption
    file_attached?: string
    isNew?: boolean
}

export default function ExpensesPage() {
    const t = useTranslations('admin.accounting.expenses')
    const tCommon = useTranslations('common')
    const { selectedCampus, loading: campusLoading } = useCampus() || {}
    const { currentAcademicYear } = useAcademic()
    const campusId = selectedCampus?.id
    const academicYear = currentAcademicYear?.name || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`

    // Campus default payment method
    const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<PaymentMethodOption>('cash')
    useEffect(() => {
        getSchoolSettings(campusId ?? null).then((res) => {
            if (res.success && res.data?.default_payment_method) {
                setDefaultPaymentMethod(res.data.default_payment_method)
            }
        }).catch(() => {})
    }, [campusId])

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

    // Rows state for editing
    const [rows, setRows] = useState<ExpenseRow[]>([])
    const [saving, setSaving] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    // Fetch expenses
    const { data: expenses, mutate, isLoading } = useSWR(
        campusId ? ['accounting-expenses', campusId, academicYear, appliedFilters.startDate, appliedFilters.endDate] : null,
        () => accountingApi.getExpenses(campusId!, academicYear, appliedFilters.startDate, appliedFilters.endDate),
        { revalidateOnFocus: false }
    )

    // Fetch categories for dropdown
    const { data: categories } = useSWR(
        campusId ? ['accounting-categories-expenses', campusId] : null,
        () => accountingApi.getCategories(campusId!, 'expenses'),
        { revalidateOnFocus: false }
    )

    // Fetch totals
    const { data: totals } = useSWR(
        campusId ? ['accounting-totals', campusId, academicYear, appliedFilters.startDate, appliedFilters.endDate] : null,
        () => accountingApi.getAccountingTotals(campusId!, academicYear, appliedFilters.startDate, appliedFilters.endDate),
        { revalidateOnFocus: false }
    )

    const createEmptyRow = (): ExpenseRow => ({
        title: '',
        category_id: '',
        amount: '',
        payment_date: format(new Date(), 'yyyy-MM-dd'),
        comments: '',
        payment_method: defaultPaymentMethod,
        isNew: true
    })

    // Initialize rows from fetched expenses
    useEffect(() => {
        if (expenses) {
            const existingRows: ExpenseRow[] = expenses.map(exp => ({
                id: exp.id,
                title: exp.title,
                category_id: exp.category_id || '',
                amount: String(exp.amount),
                payment_date: exp.payment_date,
                comments: exp.comments || '',
                payment_method: (exp.payment_method as PaymentMethodOption) || 'cash',
                file_attached: exp.file_attached
            }))
            // Add empty row for new entry
            setRows([
                ...existingRows,
                createEmptyRow()
            ])
        }
    }, [expenses])

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

    const handleRowChange = (index: number, field: keyof ExpenseRow, value: string) => {
        setRows(prev => {
            const newRows = [...prev]
            newRows[index] = { ...newRows[index], [field]: value }
            return newRows
        })
    }

    const handleDateChange = (index: number, field: 'month' | 'day' | 'year', value: string) => {
        setRows(prev => {
            const currentDate = prev[index].payment_date ? parse(prev[index].payment_date, 'yyyy-MM-dd', new Date()) : new Date()
            const newDate = new Date(currentDate)

            if (field === 'month') {
                newDate.setMonth(parseInt(value) - 1)
            } else if (field === 'day') {
                newDate.setDate(parseInt(value))
            } else if (field === 'year') {
                newDate.setFullYear(parseInt(value))
            }

            const newRows = [...prev]
            newRows[index] = { ...newRows[index], payment_date: format(newDate, 'yyyy-MM-dd') }
            return newRows
        })
    }

    const handleSave = async () => {
        if (!campusId) return

        setSaving(true)
        try {
            // Find new rows that need to be created
            const newRows = rows.filter(r => r.isNew && r.title.trim() && r.amount.trim())
            
            // Find existing rows that might have been modified
            const existingRows = rows.filter(r => !r.isNew && r.id)

            const promises: Promise<unknown>[] = []

            // Create new expenses
            for (const row of newRows) {
                promises.push(accountingApi.createExpense({
                    campus_id: campusId,
                    academic_year: academicYear,
                    title: row.title.trim(),
                    category_id: row.category_id || undefined,
                    amount: parseFloat(row.amount) || 0,
                    payment_date: row.payment_date,
                    comments: row.comments.trim() || undefined,
                    payment_method: row.payment_method
                }))
            }

            // Update existing expenses
            for (const row of existingRows) {
                const original = expenses?.find(e => e.id === row.id)
                if (original) {
                    // Check if anything changed
                    const changed = 
                        row.title !== original.title ||
                        row.category_id !== (original.category_id || '') ||
                        row.amount !== String(original.amount) ||
                        row.payment_date !== original.payment_date ||
                        row.comments !== (original.comments || '') ||
                        row.payment_method !== ((original.payment_method as PaymentMethodOption) || 'cash')

                    if (changed) {
                        promises.push(accountingApi.updateExpense(row.id!, {
                            campus_id: campusId,
                            title: row.title.trim(),
                            category_id: row.category_id || undefined,
                            amount: parseFloat(row.amount) || 0,
                            payment_date: row.payment_date,
                            comments: row.comments.trim() || undefined,
                            payment_method: row.payment_method
                        }))
                    }
                }
            }

            if (promises.length > 0) {
                await Promise.all(promises)
                toast.success(t('toast.saved_count', { count: promises.length }))
                mutate()
            } else {
                toast.info(t('toast.no_changes'))
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : tCommon('error'))
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!campusId) return
        setDeletingId(id)
        try {
            await accountingApi.deleteExpense(id, campusId)
            toast.success(t('toast.deleted'))
            mutate()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : tCommon('error'))
        } finally {
            setDeletingId(null)
        }
    }

    const handleAddRow = () => {
        setRows(prev => [...prev, createEmptyRow()])
    }

    // Parse date for display
    const getDateParts = (dateStr: string) => {
        if (!dateStr) return { month: '01', day: '01', year: String(today.getFullYear()) }
        const date = parse(dateStr, 'yyyy-MM-dd', new Date())
        return {
            month: String(date.getMonth() + 1).padStart(2, '0'),
            day: String(date.getDate()).padStart(2, '0'),
            year: String(date.getFullYear())
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount)
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

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
                    <p className="text-muted-foreground">
                        {t('subtitle', { campus: selectedCampus.name })}
                    </p>
                </div>
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? <IconLoader className="h-4 w-4 mr-2 animate-spin" /> : <IconDeviceFloppy className="h-4 w-4 mr-2" />}
                    {tCommon('save')}
                </Button>
            </div>

            {/* Date Filter */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-4 flex-wrap">
                        <span className="font-medium">{t('period')}</span>
                        <div className="flex items-center gap-2">
                            <Select value={startMonth} onValueChange={setStartMonth}>
                                <SelectTrigger className="w-28">
                                    <SelectValue placeholder={t('month')} />
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
                                    <SelectValue placeholder={t('day')} />
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
                                    <SelectValue placeholder={t('year')} />
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
                                    <SelectValue placeholder={t('month')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {MONTHS.map(m => (
                                        <SelectItem key={m.value} value={m.value}>{tCommon(`months.${m.monthKey}`)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={endDay} onValueChange={setEndDay}>
                                <SelectTrigger className="w-20">
                                    <SelectValue placeholder={t('day')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {getDaysInMonth(endMonth, endYear).map(d => (
                                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={endYear} onValueChange={setEndYear}>
                                <SelectTrigger className="w-24">
                                    <SelectValue placeholder={t('year')} />
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

            {/* Expenses Table */}
            <Card>
                <CardContent className="pt-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <>
                            {rows.length === 0 || (rows.length === 1 && rows[0].isNew && !rows[0].title) ? (
                                <p className="text-muted-foreground mb-4">{t('no_expenses')}</p>
                            ) : null}
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-8"></TableHead>
                                        <TableHead>{t('col_expense')}</TableHead>
                                        <TableHead>{t('col_category')}</TableHead>
                                        <TableHead>{tCommon('amount')}</TableHead>
                                        <TableHead>{tCommon('date')}</TableHead>
                                        <TableHead>{t('col_payment_method')}</TableHead>
                                        <TableHead>{t('col_note')}</TableHead>
                                        <TableHead>{t('col_attachment')}</TableHead>
                                        <TableHead className="w-12"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.map((row, index) => {
                                        const dateParts = getDateParts(row.payment_date)
                                        return (
                                            <TableRow key={row.id || `new-${index}`}>
                                                <TableCell>
                                                    {row.isNew ? (
                                                        <Button variant="ghost" size="icon" onClick={handleAddRow}>
                                                            <IconPlus className="h-4 w-4" />
                                                        </Button>
                                                    ) : null}
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        value={row.title}
                                                        onChange={(e) => handleRowChange(index, 'title', e.target.value)}
                                                        placeholder={t('placeholder_expense_desc')}
                                                        className="w-full"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Select
                                                        value={row.category_id || 'none'}
                                                        onValueChange={(v) => handleRowChange(index, 'category_id', v === 'none' ? '' : v)}
                                                    >
                                                        <SelectTrigger className="w-32">
                                                            <SelectValue placeholder={tCommon('na')} />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">{tCommon('na')}</SelectItem>
                                                            {categories?.map(cat => (
                                                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        value={row.amount}
                                                        onChange={(e) => handleRowChange(index, 'amount', e.target.value)}
                                                        placeholder="0.00"
                                                        className="w-24"
                                                        step="0.01"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        <Select value={dateParts.month} onValueChange={(v) => handleDateChange(index, 'month', v)}>
                                                            <SelectTrigger className="w-28">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {MONTHS.map(m => (
                                                                    <SelectItem key={m.value} value={m.value}>{tCommon(`months.${m.monthKey}`)}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <Select value={dateParts.day} onValueChange={(v) => handleDateChange(index, 'day', v)}>
                                                            <SelectTrigger className="w-16">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {getDaysInMonth(dateParts.month, dateParts.year).map(d => (
                                                                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <Select value={dateParts.year} onValueChange={(v) => handleDateChange(index, 'year', v)}>
                                                            <SelectTrigger className="w-20">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {getYears().map(y => (
                                                                    <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Select
                                                        value={row.payment_method}
                                                        onValueChange={(v) => handleRowChange(index, 'payment_method', v)}
                                                    >
                                                        <SelectTrigger className="w-32">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {PAYMENT_METHOD_OPTIONS.map(opt => (
                                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        value={row.comments}
                                                        onChange={(e) => handleRowChange(index, 'comments', e.target.value)}
                                                        placeholder={tCommon('optional')}
                                                        className="w-40"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon">
                                                        <IconPlus className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                                <TableCell>
                                                    {!row.isNew && row.id && (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="text-destructive">
                                                                    {deletingId === row.id ? (
                                                                        <IconLoader className="h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        <IconTrash className="h-4 w-4" />
                                                                    )}
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>{t('delete_title')}</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        {t('delete_confirm')}
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        onClick={() => handleDelete(row.id!)}
                                                                        className="bg-destructive text-destructive-foreground"
                                                                    >
                                                                        {tCommon('delete')}
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                            <div className="flex justify-center mt-4">
                                <Button onClick={handleSave} disabled={saving} className="bg-[#3d8fb5] hover:bg-[#357ea0]">
                                    {saving ? <IconLoader className="h-4 w-4 mr-2 animate-spin" /> : null}
                                    {tCommon('save')}
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Totals */}
            <Card>
                <CardContent className="pt-6">
                    <div className="space-y-4">
                        <div className="border-b pb-4">
                            <div className="flex justify-between text-sm">
                                <span>{t('totals.total_incomes')}:</span>
                                <span>{formatCurrency(totals?.total_incomes || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>{t('totals.less_total_expenses')}:</span>
                                <span>{formatCurrency(totals?.total_expenses || 0)}</span>
                            </div>
                            <div className="flex justify-between font-bold">
                                <span>{tCommon('balance')}:</span>
                                <span>{formatCurrency(totals?.balance || 0)}</span>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm">
                                <span>{t('totals.total_incomes')}:</span>
                                <span>{formatCurrency(totals?.total_incomes || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>{t('totals.plus_student_payments')}:</span>
                                <span>{formatCurrency(totals?.total_student_payments || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>{t('totals.less_total_expenses')}:</span>
                                <span>{formatCurrency(totals?.total_expenses || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>{t('totals.plus_staff_payments')}:</span>
                                <span>{formatCurrency(totals?.total_staff_payments || 0)}</span>
                            </div>
                            <div className="flex justify-between font-bold">
                                <span>{t('totals.general_balance')}:</span>
                                <span>{formatCurrency(totals?.general_balance || 0)}</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
