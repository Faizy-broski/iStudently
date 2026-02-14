'use client'

import { useState, useEffect } from 'react'
import { useCampus } from '@/context/CampusContext'
import { useAcademic } from '@/context/AcademicContext'
import * as accountingApi from '@/lib/api/accounting'
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

interface IncomeRow {
    id?: string
    title: string
    category_id: string
    amount: string
    income_date: string
    comments: string
    file_attached?: string
    isNew?: boolean
}

export default function IncomesPage() {
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

    // Rows state for editing
    const [rows, setRows] = useState<IncomeRow[]>([])
    const [saving, setSaving] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    // Fetch incomes
    const { data: incomes, mutate, isLoading } = useSWR(
        campusId ? ['accounting-incomes', campusId, academicYear, appliedFilters.startDate, appliedFilters.endDate] : null,
        () => accountingApi.getIncomes(campusId!, academicYear, appliedFilters.startDate, appliedFilters.endDate),
        { revalidateOnFocus: false }
    )

    // Fetch categories for dropdown
    const { data: categories } = useSWR(
        campusId ? ['accounting-categories-incomes', campusId] : null,
        () => accountingApi.getCategories(campusId!, 'incomes'),
        { revalidateOnFocus: false }
    )

    // Fetch totals
    const { data: totals } = useSWR(
        campusId ? ['accounting-totals', campusId, academicYear, appliedFilters.startDate, appliedFilters.endDate] : null,
        () => accountingApi.getAccountingTotals(campusId!, academicYear, appliedFilters.startDate, appliedFilters.endDate),
        { revalidateOnFocus: false }
    )

    const createEmptyRow = (): IncomeRow => ({
        title: '',
        category_id: '',
        amount: '',
        income_date: format(new Date(), 'yyyy-MM-dd'),
        comments: '',
        isNew: true
    })

    // Initialize rows from fetched incomes
    useEffect(() => {
        if (incomes) {
            const existingRows: IncomeRow[] = incomes.map(inc => ({
                id: inc.id,
                title: inc.title,
                category_id: inc.category_id || '',
                amount: String(inc.amount),
                income_date: inc.income_date,
                comments: inc.comments || '',
                file_attached: inc.file_attached
            }))
            // Add empty row for new entry
            setRows([
                ...existingRows,
                createEmptyRow()
            ])
        }
    }, [incomes])

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

    const handleRowChange = (index: number, field: keyof IncomeRow, value: string) => {
        setRows(prev => {
            const newRows = [...prev]
            newRows[index] = { ...newRows[index], [field]: value }
            return newRows
        })
    }

    const handleDateChange = (index: number, field: 'month' | 'day' | 'year', value: string) => {
        setRows(prev => {
            const currentDate = prev[index].income_date ? parse(prev[index].income_date, 'yyyy-MM-dd', new Date()) : new Date()
            const newDate = new Date(currentDate)

            if (field === 'month') {
                newDate.setMonth(parseInt(value) - 1)
            } else if (field === 'day') {
                newDate.setDate(parseInt(value))
            } else if (field === 'year') {
                newDate.setFullYear(parseInt(value))
            }

            const newRows = [...prev]
            newRows[index] = { ...newRows[index], income_date: format(newDate, 'yyyy-MM-dd') }
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

            // Create new incomes
            for (const row of newRows) {
                promises.push(accountingApi.createIncome({
                    campus_id: campusId,
                    academic_year: academicYear,
                    title: row.title.trim(),
                    category_id: row.category_id || undefined,
                    amount: parseFloat(row.amount) || 0,
                    income_date: row.income_date,
                    comments: row.comments.trim() || undefined
                }))
            }

            // Update existing incomes
            for (const row of existingRows) {
                const original = incomes?.find(i => i.id === row.id)
                if (original) {
                    // Check if anything changed
                    const changed = 
                        row.title !== original.title ||
                        row.category_id !== (original.category_id || '') ||
                        row.amount !== String(original.amount) ||
                        row.income_date !== original.income_date ||
                        row.comments !== (original.comments || '')

                    if (changed) {
                        promises.push(accountingApi.updateIncome(row.id!, {
                            campus_id: campusId,
                            title: row.title.trim(),
                            category_id: row.category_id || undefined,
                            amount: parseFloat(row.amount) || 0,
                            income_date: row.income_date,
                            comments: row.comments.trim() || undefined
                        }))
                    }
                }
            }

            if (promises.length > 0) {
                await Promise.all(promises)
                toast.success(`${promises.length} income(s) saved`)
                mutate()
            } else {
                toast.info('No changes to save')
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'An error occurred')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!campusId) return
        setDeletingId(id)
        try {
            await accountingApi.deleteIncome(id, campusId)
            toast.success('Income deleted')
            mutate()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'An error occurred')
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
                        <p className="text-muted-foreground text-center">Please select a campus to manage incomes.</p>
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
                    <h1 className="text-3xl font-bold tracking-tight">Incomes</h1>
                    <p className="text-muted-foreground">
                        Track revenue and money coming in • {selectedCampus.name}
                    </p>
                </div>
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? <IconLoader className="h-4 w-4 mr-2 animate-spin" /> : <IconDeviceFloppy className="h-4 w-4 mr-2" />}
                    SAVE
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

            {/* Incomes Table */}
            <Card>
                <CardContent className="pt-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <>
                            {rows.length === 0 || (rows.length === 1 && rows[0].isNew && !rows[0].title) ? (
                                <p className="text-muted-foreground mb-4">No incomes were found.</p>
                            ) : null}
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-8"></TableHead>
                                        <TableHead>INCOME</TableHead>
                                        <TableHead>CATEGORY</TableHead>
                                        <TableHead>AMOUNT</TableHead>
                                        <TableHead>DATE</TableHead>
                                        <TableHead>COMMENT</TableHead>
                                        <TableHead>FILE ATTACHED</TableHead>
                                        <TableHead className="w-12"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.map((row, index) => {
                                        const dateParts = getDateParts(row.income_date)
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
                                                        placeholder="Income description"
                                                        className="w-full"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Select
                                                        value={row.category_id || 'none'}
                                                        onValueChange={(v) => handleRowChange(index, 'category_id', v === 'none' ? '' : v)}
                                                    >
                                                        <SelectTrigger className="w-32">
                                                            <SelectValue placeholder="N/A" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">N/A</SelectItem>
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
                                                                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
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
                                                    <Input
                                                        value={row.comments}
                                                        onChange={(e) => handleRowChange(index, 'comments', e.target.value)}
                                                        placeholder="Optional comment"
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
                                                                    <AlertDialogTitle>Delete Income</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Are you sure you want to delete this income record?
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        onClick={() => handleDelete(row.id!)}
                                                                        className="bg-destructive text-destructive-foreground"
                                                                    >
                                                                        Delete
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
                                    SAVE
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
                                <span>Total from Incomes:</span>
                                <span>{formatCurrency(totals?.total_incomes || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>Less: Total from Expenses:</span>
                                <span>{formatCurrency(totals?.total_expenses || 0)}</span>
                            </div>
                            <div className="flex justify-between font-bold">
                                <span>Balance:</span>
                                <span>{formatCurrency(totals?.balance || 0)}</span>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm">
                                <span>Total from Incomes:</span>
                                <span>{formatCurrency(totals?.total_incomes || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>&amp; Total from Student Payments:</span>
                                <span>{formatCurrency(totals?.total_student_payments || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>Less: Total from Expenses:</span>
                                <span>{formatCurrency(totals?.total_expenses || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>&amp; Total from Staff Payments:</span>
                                <span>{formatCurrency(totals?.total_staff_payments || 0)}</span>
                            </div>
                            <div className="flex justify-between font-bold">
                                <span>General Balance:</span>
                                <span>{formatCurrency(totals?.general_balance || 0)}</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
