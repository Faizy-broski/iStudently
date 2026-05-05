'use client'

import { useState, useEffect } from 'react'
import { useCampus } from '@/context/CampusContext'
import { useAcademic } from '@/context/AcademicContext'
import * as accountingApi from '@/lib/api/accounting'
import * as salaryApi from '@/lib/api/salary'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { IconPlus, IconTrash, IconLoader, IconDeviceFloppy, IconArrowLeft, IconSearch, IconUsers, IconCheck, IconClock, IconCircleCheck } from '@tabler/icons-react'
import { toast } from 'sonner'
import useSWR from 'swr'
import { format, parse } from 'date-fns'
import { getAllStaff, Staff } from '@/lib/api/staff'
import { getSchoolSettings, PAYMENT_METHOD_OPTIONS, type PaymentMethodOption } from '@/lib/api/school-settings'
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

interface StaffPaymentRow {
    id?: string
    receipt_number?: string
    amount: string
    payment_date: string
    comments: string
    file_attached?: string
    isNew?: boolean
}

export default function StaffPaymentsPage() {
    const t = useTranslations('admin.accounting.staff_payments')
    const tCommon = useTranslations('common')
    const { selectedCampus, loading: campusLoading } = useCampus() || {}
    const { currentAcademicYear } = useAcademic()
    const campusId = selectedCampus?.id
    const schoolId = selectedCampus?.parent_school_id || campusId
    const academicYear = currentAcademicYear?.name || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`

    const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [activeTab, setActiveTab] = useState<'payments' | 'salaries'>('salaries')

    const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<PaymentMethodOption>('cash')
    useEffect(() => {
        getSchoolSettings(campusId ?? null).then((res) => {
            if (res.success && res.data?.default_payment_method) {
                setDefaultPaymentMethod(res.data.default_payment_method)
            }
        }).catch(() => {})
    }, [campusId])

    const [rows, setRows] = useState<StaffPaymentRow[]>([])
    const [saving, setSaving] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [markingPaidId, setMarkingPaidId] = useState<string | null>(null)

    const today = new Date()

    type StaffWithExtras = Staff & { role?: string; salary?: number }

    const { data: staffResponse, isLoading: staffLoading } = useSWR(
        campusId ? ['staff-list-employees', campusId] : null,
        async () => getAllStaff(1, 1000, undefined, 'employees', campusId!),
        { revalidateOnFocus: false }
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const staffList: StaffWithExtras[] = Array.isArray((staffResponse as any)?.data?.data) ? (staffResponse as any).data.data : []

    const { data: staffPayments, mutate, isLoading: paymentsLoading } = useSWR(
        campusId && selectedStaff ? ['accounting-staff-payments', campusId, selectedStaff.id, academicYear] : null,
        () => accountingApi.getStaffPaymentsByStaff(campusId!, selectedStaff!.id, academicYear),
        { revalidateOnFocus: false }
    )

    const { data: salaryRecordsData, mutate: mutateSalaries, isLoading: salariesLoading } = useSWR(
        schoolId && campusId && selectedStaff ? ['salary-records', campusId, selectedStaff.id] : null,
        () => salaryApi.getSalaryRecords(schoolId!, { campus_id: campusId!, staff_id: selectedStaff!.id, limit: 100 }),
        { revalidateOnFocus: false }
    )
    const salaryRecords = salaryRecordsData?.data || []

    const filteredStaff = staffList.filter((staff: StaffWithExtras) => {
        const fullName = `${staff.profile?.first_name || ''} ${staff.profile?.last_name || ''}`.toLowerCase()
        return fullName.includes(searchQuery.toLowerCase())
    })

    const createEmptyRow = (): StaffPaymentRow => ({
        receipt_number: '',
        amount: '',
        payment_date: format(new Date(), 'yyyy-MM-dd'),
        comments: '',
        isNew: true
    })

    useEffect(() => {
        if (selectedStaff && staffPayments) {
            const existingRows: StaffPaymentRow[] = staffPayments.map(payment => ({
                id: payment.id,
                receipt_number: payment.receipt_number,
                amount: String(payment.amount),
                payment_date: payment.payment_date,
                comments: payment.comments || '',
                file_attached: payment.file_attached
            }))
            setRows([...existingRows, createEmptyRow()])
        } else if (selectedStaff) {
            setRows([createEmptyRow()])
        }
    }, [selectedStaff, staffPayments])

    const handleRowChange = (index: number, field: keyof StaffPaymentRow, value: string) => {
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
            if (field === 'month') newDate.setMonth(parseInt(value) - 1)
            else if (field === 'day') newDate.setDate(parseInt(value))
            else if (field === 'year') newDate.setFullYear(parseInt(value))
            const newRows = [...prev]
            newRows[index] = { ...newRows[index], payment_date: format(newDate, 'yyyy-MM-dd') }
            return newRows
        })
    }

    const handleSave = async () => {
        if (!campusId || !selectedStaff) return
        setSaving(true)
        try {
            const newRows = rows.filter(r => r.isNew && r.amount.trim())
            const existingRows = rows.filter(r => !r.isNew && r.id)
            const promises: Promise<unknown>[] = []

            for (const row of newRows) {
                promises.push(accountingApi.createStaffPayment({
                    campus_id: campusId,
                    academic_year: academicYear,
                    title: `Payment to ${selectedStaff.profile?.first_name} ${selectedStaff.profile?.last_name}`,
                    staff_id: selectedStaff.id,
                    amount: parseFloat(row.amount) || 0,
                    payment_date: row.payment_date,
                    comments: row.comments.trim() || undefined,
                    receipt_number: row.receipt_number || undefined
                }))
            }

            for (const row of existingRows) {
                const original = staffPayments?.find(p => p.id === row.id)
                if (original) {
                    const changed =
                        row.amount !== String(original.amount) ||
                        row.payment_date !== original.payment_date ||
                        row.comments !== (original.comments || '') ||
                        row.receipt_number !== original.receipt_number

                    if (changed) {
                        promises.push(accountingApi.updateStaffPayment(row.id!, {
                            campus_id: campusId,
                            title: `Payment to ${selectedStaff.profile?.first_name} ${selectedStaff.profile?.last_name}`,
                            amount: parseFloat(row.amount) || 0,
                            payment_date: row.payment_date,
                            comments: row.comments.trim() || undefined,
                            receipt_number: row.receipt_number
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
            await accountingApi.deleteStaffPayment(id, campusId)
            toast.success(t('toast.deleted'))
            mutate()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : tCommon('error'))
        } finally {
            setDeletingId(null)
        }
    }

    const handleAddRow = () => setRows(prev => [...prev, createEmptyRow()])

    const handleApproveSalary = async (salaryRecordId: string) => {
        if (!schoolId) return
        setMarkingPaidId(salaryRecordId)
        try {
            await salaryApi.approveSalary(salaryRecordId, schoolId)
            toast.success(t('toast.salary_approved'))
            mutateSalaries()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t('toast.salary_approve_failed'))
        } finally {
            setMarkingPaidId(null)
        }
    }

    const handleMarkSalaryPaid = async (salaryRecordId: string) => {
        if (!schoolId) return
        setMarkingPaidId(salaryRecordId)
        try {
            await salaryApi.markSalaryPaid(salaryRecordId, { school_id: schoolId, payment_method: defaultPaymentMethod })
            toast.success(t('toast.salary_marked_paid'))
            mutateSalaries()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t('toast.salary_mark_paid_failed'))
        } finally {
            setMarkingPaidId(null)
        }
    }

    const getDateParts = (dateStr: string) => {
        if (!dateStr) return { month: '01', day: '01', year: String(today.getFullYear()) }
        const date = parse(dateStr, 'yyyy-MM-dd', new Date())
        return {
            month: String(date.getMonth() + 1).padStart(2, '0'),
            day: String(date.getDate()).padStart(2, '0'),
            year: String(date.getFullYear())
        }
    }

    const getMonthName = (month: number) => new Date(2000, month - 1).toLocaleString('default', { month: 'long' })

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><IconClock className="h-3 w-3 mr-1" />{tCommon('pending')}</Badge>
            case 'approved':
                return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><IconCheck className="h-3 w-3 mr-1" />{tCommon('approved')}</Badge>
            case 'paid':
                return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><IconCircleCheck className="h-3 w-3 mr-1" />{tCommon('paid')}</Badge>
            default:
                return <Badge variant="outline">{status}</Badge>
        }
    }

    const getRoleLabel = (role?: string) => {
        if (!role) return t('roles.staff')
        const key = role as 'teacher' | 'admin' | 'librarian' | 'counselor' | 'staff'
        return t(`roles.${key}`, { defaultMessage: role })
    }

    const totalPayments = rows
        .filter(r => !r.isNew || r.amount.trim())
        .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0)

    const totalSalaryDue = salaryRecords
        .filter(r => r.status !== 'paid')
        .reduce((sum, r) => sum + Number(r.net_salary || 0), 0)
    const totalSalaryPaid = salaryRecords
        .filter(r => r.status === 'paid')
        .reduce((sum, r) => sum + Number(r.net_salary || 0), 0)

    const legacySalary = (selectedStaff as StaffWithExtras)?.salary || 0
    const balance = legacySalary - totalPayments

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

    if (!selectedStaff) {
        return (
            <div className="container mx-auto py-6 space-y-6">
                <div className="flex items-center gap-3">
                    <IconUsers className="h-8 w-8 text-[#3d8fb5]" />
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
                        <p className="text-muted-foreground">{t('subtitle_select')}</p>
                    </div>
                </div>

                <div className="text-[#3d8fb5] cursor-pointer hover:underline text-sm">
                    {tCommon('view_expanded')}
                </div>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-sm text-muted-foreground">
                                {t('found_count', { count: filteredStaff.length })}
                            </p>
                            <div className="relative">
                                <Input
                                    placeholder={tCommon('search')}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-48 pr-8"
                                />
                                <IconSearch className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            </div>
                        </div>

                        {staffLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t('col_user')}</TableHead>
                                        <TableHead>{t('col_role')}</TableHead>
                                        <TableHead>{t('col_title')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredStaff.map((staff: StaffWithExtras) => (
                                        <TableRow key={staff.id} className="cursor-pointer hover:bg-muted/50">
                                            <TableCell>
                                                <span
                                                    className="text-[#3d8fb5] hover:underline cursor-pointer"
                                                    onClick={() => setSelectedStaff(staff)}
                                                >
                                                    {staff.profile?.first_name} {staff.profile?.last_name}
                                                </span>
                                            </TableCell>
                                            <TableCell>{getRoleLabel(staff.role)}</TableCell>
                                            <TableCell>{staff.title || '-'}</TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredStaff.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                                {t('empty')}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedStaff(null)}>
                        <IconArrowLeft className="h-5 w-5" />
                    </Button>
                    <IconUsers className="h-8 w-8 text-[#3d8fb5]" />
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
                        <p className="text-muted-foreground">
                            {selectedStaff.profile?.first_name} {selectedStaff.profile?.last_name}
                            {selectedStaff.title && <span className="ml-2 text-sm">({selectedStaff.title})</span>}
                        </p>
                    </div>
                </div>
                {activeTab === 'payments' && (
                    <Button onClick={handleSave} disabled={saving} className="bg-[#3d8fb5] hover:bg-[#357ea0]">
                        {saving ? <IconLoader className="h-4 w-4 mr-2 animate-spin" /> : <IconDeviceFloppy className="h-4 w-4 mr-2" />}
                        {tCommon('save')}
                    </Button>
                )}
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'payments' | 'salaries')}>
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                    <TabsTrigger value="salaries">{t('tab_salary_records')}</TabsTrigger>
                    <TabsTrigger value="payments">{t('tab_manual_payments')}</TabsTrigger>
                </TabsList>

                <TabsContent value="salaries" className="space-y-4">
                    <Card>
                        <CardContent className="pt-6">
                            {salariesLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : salaryRecords.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">{t('no_salary_records')}</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>{t('salary_col_period')}</TableHead>
                                            <TableHead>{t('salary_col_base')}</TableHead>
                                            <TableHead>{t('salary_col_allowances')}</TableHead>
                                            <TableHead>{t('salary_col_deductions')}</TableHead>
                                            <TableHead>{t('salary_col_net')}</TableHead>
                                            <TableHead>{tCommon('status')}</TableHead>
                                            <TableHead className="text-right">{tCommon('actions')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {salaryRecords.map((record) => (
                                            <TableRow key={record.id}>
                                                <TableCell className="font-medium">
                                                    {getMonthName(record.month)} {record.year}
                                                </TableCell>
                                                <TableCell>{record.base_salary}</TableCell>
                                                <TableCell className="text-green-600">+{record.total_allowances + record.attendance_bonus}</TableCell>
                                                <TableCell className="text-red-600">-{record.total_deductions + record.advance_deduction}</TableCell>
                                                <TableCell className="font-semibold">{record.net_salary}</TableCell>
                                                <TableCell>{getStatusBadge(record.status)}</TableCell>
                                                <TableCell className="text-right">
                                                    {record.status === 'pending' && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleApproveSalary(record.id)}
                                                            disabled={markingPaidId === record.id}
                                                        >
                                                            {markingPaidId === record.id ? (
                                                                <IconLoader className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <><IconCheck className="h-4 w-4 mr-1" />{t('approve')}</>
                                                            )}
                                                        </Button>
                                                    )}
                                                    {record.status === 'approved' && (
                                                        <Button
                                                            size="sm"
                                                            className="bg-green-600 hover:bg-green-700"
                                                            onClick={() => handleMarkSalaryPaid(record.id)}
                                                            disabled={markingPaidId === record.id}
                                                        >
                                                            {markingPaidId === record.id ? (
                                                                <IconLoader className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <><IconCircleCheck className="h-4 w-4 mr-1" />{t('mark_paid')}</>
                                                            )}
                                                        </Button>
                                                    )}
                                                    {record.status === 'paid' && record.payment_date && (
                                                        <span className="text-sm text-muted-foreground">
                                                            {t('paid_on', { date: format(new Date(record.payment_date), 'MMM d, yyyy') })}
                                                        </span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="space-y-2 max-w-sm">
                                <div className="flex justify-between text-sm">
                                    <span>{t('salary_total_paid')}</span>
                                    <span className="text-green-600">{totalSalaryPaid}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>{t('salary_total_pending')}</span>
                                    <span className="text-yellow-600">{totalSalaryDue}</span>
                                </div>
                                <div className="flex justify-between font-bold border-t pt-2">
                                    <span>{t('salary_grand_total')}</span>
                                    <span>{totalSalaryPaid + totalSalaryDue}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="payments" className="space-y-4">
                    <Card>
                        <CardContent className="pt-6">
                            {paymentsLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <>
                                    {rows.length === 1 && rows[0].isNew && !rows[0].amount && (
                                        <p className="text-muted-foreground mb-4">{t('no_manual_payments')}</p>
                                    )}
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-8"></TableHead>
                                                <TableHead>{t('col_receipt')}</TableHead>
                                                <TableHead>{tCommon('amount')}</TableHead>
                                                <TableHead>{tCommon('date')}</TableHead>
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
                                                            {row.isNew && (
                                                                <Button variant="ghost" size="icon" onClick={handleAddRow}>
                                                                    <IconPlus className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                value={row.receipt_number ?? ''}
                                                                onChange={(e) => handleRowChange(index, 'receipt_number', e.target.value)}
                                                                placeholder={t('auto_receipt')}
                                                                className="w-32"
                                                                disabled={!row.isNew}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number"
                                                                value={row.amount}
                                                                onChange={(e) => handleRowChange(index, 'amount', e.target.value)}
                                                                placeholder="0.00"
                                                                className="w-32"
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
                                                            <Input
                                                                value={row.comments}
                                                                onChange={(e) => handleRowChange(index, 'comments', e.target.value)}
                                                                placeholder=""
                                                                className="w-48"
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
                                                                            <AlertDialogDescription>{t('delete_confirm')}</AlertDialogDescription>
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

                    <Card>
                        <CardContent className="pt-6">
                            <div className="space-y-2 max-w-xs">
                                <div className="flex justify-between text-sm">
                                    <span>{t('payment_total_base')}</span>
                                    <span>{legacySalary}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>{t('payment_less_manual')}</span>
                                    <span>{totalPayments}</span>
                                </div>
                                <div className="flex justify-between font-bold border-t pt-2">
                                    <span>{tCommon('balance')}</span>
                                    <span>{balance}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
