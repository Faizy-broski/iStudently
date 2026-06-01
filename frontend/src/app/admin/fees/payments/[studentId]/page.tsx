'use client'

import { useState, useRef, useCallback, use, useEffect } from 'react'
import { useCampus } from '@/context/CampusContext'
import { useAuth } from '@/context/AuthContext'
import { useSchoolSettings } from '@/hooks/useSchoolSettings'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { IconLoader, IconPlus, IconTrash, IconCalendar, IconUpload, IconPencil, IconCheck, IconX } from '@tabler/icons-react'
import useSWR from 'swr'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { getSchoolSettings, PAYMENT_METHOD_OPTIONS, type PaymentMethodOption } from '@/lib/api/school-settings'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Payment {
    id: string
    receipt_number?: string
    amount: number
    payment_date: string
    comment?: string
    is_lunch_payment: boolean
    payment_method?: string
    file_url?: string
    created_at: string
    created_by_profile?: {
        first_name: string
        last_name: string
    }
}

interface StudentInfo {
    id: string
    student_number: string
    first_name: string
    last_name: string
}

interface PaymentResponse {
    payments: Payment[]
    summary: {
        totalFees: number
        totalPayments: number
        balance: number
    }
    studentInfo?: StudentInfo
}

interface NewPayment {
    receipt_number?: string
    amount: string
    month: string
    day: string
    year: string
    comment: string
    is_lunch_payment: boolean
    payment_method: PaymentMethodOption
    file?: File | null
}

async function fetchStudentPayments(studentId: string, schoolId: string): Promise<PaymentResponse> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    const res = await fetch(`${API_BASE}/api/fees/payments/student/${studentId}?school_id=${schoolId}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return json.data
}


const MONTH_KEYS = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
]

const getDaysInMonth = (monthKey: string, year: string) => {
    const monthIndex = MONTH_KEYS.indexOf(monthKey) + 1 // 1-based
    const daysInMonth = new Date(parseInt(year), monthIndex, 0).getDate()
    return Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString())
}

export default function StudentPaymentsPage({ params }: { params: Promise<{ studentId: string }> }) {
    const t = useTranslations('fees.payments')
    const tm = useTranslations('fees.months')
    const resolvedParams = use(params)
    const studentId = resolvedParams.studentId
    
    const { selectedCampus, loading: campusLoading } = useCampus() || {}
    useAuth()
    const { formatCurrency: formatDynamicCurrency } = useSchoolSettings()
    const schoolId = selectedCampus?.id

    const [viewMode, setViewMode] = useState<'original' | 'expanded'>('original')
    const printRef = useRef<HTMLDivElement>(null)

    // Load campus-specific default payment method
    const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<PaymentMethodOption>('cash')
    useEffect(() => {
        getSchoolSettings(schoolId ?? null).then((res) => {
            if (res.success && res.data?.default_payment_method) {
                setDefaultPaymentMethod(res.data.default_payment_method)
            }
        }).catch(() => {})
    }, [schoolId])

    const handlePrint = useCallback(() => {
        const content = printRef.current
        if (!content) return

        const printWindow = window.open('', '_blank')
        if (!printWindow) return

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${t('paymentReceipts')}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .receipt { border: 2px solid #333; padding: 24px; margin-bottom: 32px; page-break-after: always; }
                    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 16px; margin-bottom: 16px; }
                    .header h1 { font-size: 24px; margin-bottom: 4px; }
                    .header p { color: #666; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
                    .info-grid .right { text-align: right; }
                    .amount-box { background: #f0f0f0; border: 1px solid #ddd; padding: 24px; text-align: center; margin-bottom: 24px; }
                    .amount-box .label { color: #666; font-size: 14px; margin-bottom: 8px; }
                    .amount-box .amount { font-size: 32px; font-weight: bold; color: #16a34a; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
                    th, td { border: 1px solid #333; padding: 8px; text-align: left; }
                    th { background: #f0f0f0; width: 40%; }
                    .footer { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #333; padding-top: 16px; }
                    .footer .date { font-size: 12px; color: #666; }
                    .footer .signature { text-align: center; }
                    .footer .signature-line { border-top: 1px solid #333; padding-top: 4px; margin-top: 48px; width: 200px; }
                    @media print { .receipt:last-child { page-break-after: auto; } }
                </style>
            </head>
            <body>${content.innerHTML}</body>
            </html>
        `)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => {
            printWindow.print()
            printWindow.close()
        }, 250)
    }, [])
    const [saving, setSaving] = useState(false)
    const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
    const [editingValues, setEditingValues] = useState<{
        amount: string
        payment_date: string
        comment: string
        payment_method: string
        is_lunch_payment: boolean
    }>({ amount: '', payment_date: '', comment: '', payment_method: 'cash', is_lunch_payment: false })
    const [openCalendarIndex, setOpenCalendarIndex] = useState<number | null>(null)
    const [uploadingFileForId, setUploadingFileForId] = useState<string | null>(null)
    const fileUploadRef = useRef<HTMLInputElement>(null)
    const uploadTargetPaymentId = useRef<string | null>(null)

    const handleCalendarSelect = (index: number, date: Date | undefined) => {
        if (!date) return
        const updated = [...newPayments]
        updated[index] = {
            ...updated[index],
            month: MONTH_KEYS[date.getMonth()],
            day: date.getDate().toString(),
            year: date.getFullYear().toString(),
        }
        setNewPayments(updated)
        setOpenCalendarIndex(null)
    }
    const [newPayments, setNewPayments] = useState<NewPayment[]>([{
        receipt_number: '',
        amount: '',
        month: MONTH_KEYS[new Date().getMonth()],
        day: new Date().getDate().toString(),
        year: new Date().getFullYear().toString(),
        comment: '',
        is_lunch_payment: false,
        payment_method: defaultPaymentMethod,
        file: null
    }])

    // Fetch payments (includes studentInfo)
    const { data: paymentData, isLoading: paymentsLoading, mutate: mutatePayments } = useSWR<PaymentResponse>(
        schoolId && studentId ? ['student-payments', studentId, schoolId] : null,
        () => fetchStudentPayments(studentId, schoolId!)
    )

    const payments = paymentData?.payments || []
    const summary = paymentData?.summary || { totalFees: 0, totalPayments: 0, balance: 0 }
    const student = paymentData?.studentInfo

    // Format currency
    // Use the dynamic formatter from the hook
    const formatCurrency = (amount: number) => formatDynamicCurrency(amount)

    // Format date
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    // Format student name
    const formatStudentName = () => {
        if (!student) return ''
        return `${student.first_name} ${student.last_name}`.toUpperCase()
    }

    // Add new payment row
    const addPaymentRow = () => {
        setNewPayments([...newPayments, {
            receipt_number: '',
            amount: '',
            month: MONTH_KEYS[new Date().getMonth()],
            day: new Date().getDate().toString(),
            year: new Date().getFullYear().toString(),
            comment: '',
            is_lunch_payment: false,
            payment_method: defaultPaymentMethod,
            file: null
        }])
    }

    // Update payment row
    const updatePaymentRow = (index: number, field: keyof NewPayment, value: string | boolean | File | null) => {
        const updated = [...newPayments]
        const updatedRow = { ...updated[index], [field]: value }

        // When month or year changes, clamp day to avoid invalid dates (e.g. Feb 31)
        if (field === 'month' || field === 'year') {
            const maxDay = getDaysInMonth(
                field === 'month' ? (value as string) : updatedRow.month,
                field === 'year' ? (value as string) : updatedRow.year
            ).length
            if (parseInt(updatedRow.day) > maxDay) {
                updatedRow.day = maxDay.toString()
            }
        }

        updated[index] = updatedRow
        setNewPayments(updated)
    }

    // Remove payment row
    const removePaymentRow = (index: number) => {
        if (newPayments.length > 1) {
            setNewPayments(newPayments.filter((_, i) => i !== index))
        }
    }

    // Inline edit existing payments
    const startEdit = (payment: Payment) => {
        setEditingPaymentId(payment.id)
        setEditingValues({
            amount: payment.amount.toString(),
            payment_date: payment.payment_date.slice(0, 10),
            comment: payment.comment || '',
            payment_method: payment.payment_method || 'cash',
            is_lunch_payment: payment.is_lunch_payment,
        })
    }

    const cancelEdit = () => setEditingPaymentId(null)

    const saveEdit = async (paymentId: string) => {
        if (!editingValues.amount || parseFloat(editingValues.amount) <= 0) {
            toast.error(t('enterAtLeastOne'))
            return
        }
        try {
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()
            const res = await fetch(`${API_BASE}/api/fees/payments/${paymentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    school_id: schoolId,
                    amount: parseFloat(editingValues.amount),
                    payment_date: new Date(editingValues.payment_date).toISOString(),
                    comment: editingValues.comment || null,
                    is_lunch_payment: editingValues.is_lunch_payment,
                    payment_method: editingValues.payment_method,
                })
            })
            const json = await res.json()
            if (!json.success) throw new Error(json.error)
            toast.success(t('paymentSaved'))
            setEditingPaymentId(null)
            mutatePayments()
        } catch (error: unknown) {
            const err = error as Error
            toast.error(err.message || t('saveFailed'))
        }
    }

    // Save payments
    const handleSave = async () => {
        const validPayments = newPayments.filter(p => p.amount && parseFloat(p.amount) > 0)
        
        if (validPayments.length === 0) {
            toast.error(t('enterAtLeastOne'))
            return
        }

        setSaving(true)
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()

        try {
            for (const payment of validPayments) {
                const monthIndex = MONTH_KEYS.indexOf(payment.month)
                const paymentDate = new Date(
                    parseInt(payment.year),
                    monthIndex,
                    parseInt(payment.day)
                ).toISOString()

                let fileUrl = undefined
                if (payment.file) {
                    const safeName = payment.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
                    const fileName = `payments/${studentId}/${Date.now()}_${safeName}`
                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from('fee-attachments')
                        .upload(fileName, payment.file, { upsert: true })

                    if (!uploadError && uploadData) {
                        const { data: urlData } = supabase.storage
                            .from('fee-attachments')
                            .getPublicUrl(fileName)
                        fileUrl = urlData.publicUrl
                    }
                }

                const res = await fetch(`${API_BASE}/api/fees/payments/record`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`
                    },
                    body: JSON.stringify({
                        school_id: schoolId,
                        student_id: studentId,
                        amount: parseFloat(payment.amount),
                        payment_date: paymentDate,
                        comment: payment.comment || null,
                        is_lunch_payment: payment.is_lunch_payment,
                        payment_method: payment.payment_method || defaultPaymentMethod,
                        file_url: fileUrl,
                        receipt_number: payment.receipt_number || undefined
                    })
                })

                const json = await res.json()
                if (!json.success) throw new Error(json.error)
            }

            toast.success(t('paymentSaved'))
            
            // Reset form and refresh data
            setNewPayments([{
                amount: '',
                month: MONTH_KEYS[new Date().getMonth()],
                day: new Date().getDate().toString(),
                year: new Date().getFullYear().toString(),
                comment: '',
                is_lunch_payment: false,
                payment_method: defaultPaymentMethod,
                file: null
            }])
            
            mutatePayments()
        } catch (error: unknown) {
            const err = error as Error
            toast.error(err.message || t('saveFailed'))
        } finally {
            setSaving(false)
        }
    }

    // Upload file for an existing payment
    const handleUploadFileForPayment = async (paymentId: string, file: File) => {
        setUploadingFileForId(paymentId)
        try {
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()

            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
            const fileName = `payments/${studentId}/${Date.now()}_${safeName}`
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('fee-attachments')
                .upload(fileName, file, { upsert: true })

            if (uploadError || !uploadData) {
                toast.error(uploadError?.message || t('uploadFailed'))
                return
            }

            const { data: urlData } = supabase.storage
                .from('fee-attachments')
                .getPublicUrl(fileName)

            const res = await fetch(`${API_BASE}/api/fees/payments/${paymentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    school_id: schoolId,
                    file_url: urlData.publicUrl
                })
            })

            const json = await res.json()
            if (!json.success) throw new Error(json.error)

            toast.success(t('uploadSuccess'))
            mutatePayments()
        } catch (error: unknown) {
            const err = error as Error
            toast.error(err.message || t('uploadFailed'))
        } finally {
            setUploadingFileForId(null)
            uploadTargetPaymentId.current = null
        }
    }

    // Delete existing payment
    const handleDeletePayment = async (paymentId: string) => {
        if (!confirm(t('deleteConfirm'))) return

        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()

        try {
            const res = await fetch(`${API_BASE}/api/fees/payments/${paymentId}?school_id=${schoolId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            })

            const json = await res.json()
            if (!json.success) throw new Error(json.error)

            toast.success(t('paymentDeleted'))
            mutatePayments()
        } catch (error: unknown) {
            const err = error as Error
            toast.error(err.message || t('deleteFailed'))
        }
    }

    // Generate days for select
    // years list static
    const years = Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - 5 + i).toString())

    if (campusLoading || paymentsLoading) {
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
                        <p className="text-muted-foreground text-center">{t('pleaseSelectCampus')}</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <>
        <div className="container mx-auto py-6 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <span className="text-3xl">🔔</span>
                <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
            </div>

            {/* Print Receipt Link */}
            <div>
                <Link
                    href="#"
                    className="text-[#3d8fb5] hover:underline text-sm"
                    onClick={(e) => {
                        e.preventDefault()
                        if (payments.length > 0) handlePrint()
                    }}
                >
                    {t('printReceipt')}{payments.length > 1 ? 's' : ''}
                </Link>
            </div>

            {/* View Toggle */}
            <div className="flex items-center justify-between">
                <Link 
                    href="#" 
                    className="text-[#3d8fb5] hover:underline text-sm"
                    onClick={(e) => { 
                        e.preventDefault()
                        setViewMode(viewMode === 'original' ? 'expanded' : 'original')
                    }}
                >
                    {viewMode === 'original' ? t('expandedView') : t('originalView')}
                </Link>
                <Button 
                    className="bg-[#3d8fb5] hover:bg-[#357a9e]"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? <IconLoader className="h-4 w-4 animate-spin mr-2" /> : null}
                    {t('codes_save')}
                </Button>
            </div>

            {/* Divider */}
            <hr className="border-gray-300" />

            {/* Student Name Header */}
            {student && (
                <div className="bg-gray-100 p-3 text-sm font-medium text-gray-700">
                    {formatStudentName()} | {student.student_number}
                </div>
            )}

            {/* No Payments Message */}
            {payments.length === 0 && (
                <p className="text-sm font-medium text-gray-700">{t('noPayments')}</p>
            )}

            {/* Payments Table */}
            <Card className="border shadow-sm">
                <CardContent className="p-0">
                    {paymentsLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-100">
                                    <TableHead className="w-10"></TableHead>
                                    <TableHead className="text-[#3d8fb5] font-semibold text-center">{t('th_receipt')}</TableHead>
                                    <TableHead className="text-[#3d8fb5] font-semibold text-center">{t('th_amount')}</TableHead>
                                    <TableHead className="text-[#3d8fb5] font-semibold text-center">{t('paymentDate')}</TableHead>
                                    <TableHead className="text-[#3d8fb5] font-semibold text-center">{t('th_comment')}</TableHead>
                                    <TableHead className="text-[#3d8fb5] font-semibold text-center">{t('th_method')}</TableHead>
                                    <TableHead className="text-[#3d8fb5] font-semibold text-center">{t('th_lunchPayment')}</TableHead>
                                    <TableHead className="text-[#3d8fb5] font-semibold text-center">{t('th_attachment')}</TableHead>
                                    {viewMode === 'expanded' && (
                                        <>
                                            <TableHead className="text-[#3d8fb5] font-semibold text-center">{t('th_createdBy')}</TableHead>
                                            <TableHead className="text-[#3d8fb5] font-semibold text-center">{t('th_createdAt')}</TableHead>
                                        </>
                                    )}
                                    <TableHead className="w-10"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {/* Existing Payments */}
                                {payments.map((payment, index) => {
                                    const isEditing = editingPaymentId === payment.id
                                    return (
                                    <TableRow
                                        key={payment.id}
                                        className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                                    >
                                        <TableCell></TableCell>
                                        <TableCell>{payment.receipt_number || '-'}</TableCell>

                                        {/* Amount */}
                                        <TableCell>
                                            {isEditing ? (
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={editingValues.amount}
                                                    onChange={e => setEditingValues(v => ({ ...v, amount: e.target.value }))}
                                                    className="w-24 h-8"
                                                />
                                            ) : formatCurrency(payment.amount)}
                                        </TableCell>

                                        {/* Payment Date */}
                                        <TableCell>
                                            {isEditing ? (
                                                <input
                                                    type="date"
                                                    value={editingValues.payment_date}
                                                    onChange={e => setEditingValues(v => ({ ...v, payment_date: e.target.value }))}
                                                    className="h-8 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                                />
                                            ) : formatDate(payment.payment_date)}
                                        </TableCell>

                                        {/* Comment */}
                                        <TableCell>
                                            {isEditing ? (
                                                <Input
                                                    value={editingValues.comment}
                                                    onChange={e => setEditingValues(v => ({ ...v, comment: e.target.value }))}
                                                    className="w-full h-8"
                                                />
                                            ) : (payment.comment || '-')}
                                        </TableCell>

                                        {/* Method */}
                                        <TableCell>
                                            {isEditing ? (
                                                <Select
                                                    value={editingValues.payment_method}
                                                    onValueChange={v => setEditingValues(ev => ({ ...ev, payment_method: v }))}
                                                >
                                                    <SelectTrigger className="w-32 h-8">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {PAYMENT_METHOD_OPTIONS.map(opt => (
                                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <span className="capitalize">{payment.payment_method?.replace('_', ' ') || t('cash')}</span>
                                            )}
                                        </TableCell>

                                        {/* Lunch Payment */}
                                        <TableCell className="text-center">
                                            <Checkbox
                                                checked={isEditing ? editingValues.is_lunch_payment : payment.is_lunch_payment}
                                                disabled={!isEditing}
                                                onCheckedChange={isEditing ? (checked) => setEditingValues(v => ({ ...v, is_lunch_payment: !!checked })) : undefined}
                                            />
                                        </TableCell>

                                        {/* Attachment */}
                                        <TableCell className="text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                {payment.file_url ? (
                                                    <a
                                                        href={payment.file_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[#3d8fb5] hover:underline text-sm"
                                                    >
                                                        {t('view')}
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-400 text-sm">-</span>
                                                )}
                                                {uploadingFileForId === payment.id ? (
                                                    <IconLoader className="h-4 w-4 animate-spin text-gray-400" />
                                                ) : (
                                                    <button
                                                        type="button"
                                                        title={payment.file_url ? t('replaceFile') : t('attachFile')}
                                                        className="text-gray-400 hover:text-[#3d8fb5] transition-colors"
                                                        onClick={() => {
                                                            uploadTargetPaymentId.current = payment.id
                                                            fileUploadRef.current?.click()
                                                        }}
                                                    >
                                                        <IconUpload className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </TableCell>

                                        {viewMode === 'expanded' && (
                                            <>
                                                <TableCell>
                                                    {payment.created_by_profile
                                                        ? `${payment.created_by_profile.first_name} ${payment.created_by_profile.last_name}`
                                                        : '-'
                                                    }
                                                </TableCell>
                                                <TableCell>{formatDate(payment.created_at)}</TableCell>
                                            </>
                                        )}

                                        {/* Actions */}
                                        <TableCell>
                                            {isEditing ? (
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                        onClick={() => saveEdit(payment.id)}
                                                    >
                                                        <IconCheck className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                                                        onClick={cancelEdit}
                                                    >
                                                        <IconX className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                                        onClick={() => startEdit(payment)}
                                                    >
                                                        <IconPencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => handleDeletePayment(payment.id)}
                                                    >
                                                        <IconTrash className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                    )
                                })}

                                {/* New Payment Rows */}
                                {newPayments.map((payment, index) => (
                                    <TableRow key={`new-${index}`} className="bg-white">
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0"
                                                onClick={addPaymentRow}
                                            >
                                                <IconPlus className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={payment.receipt_number ?? ''}
                                                readOnly
                                                placeholder={t('auto')}
                                                className="w-24 h-8 bg-muted cursor-not-allowed select-none"
                                                title={t('receiptAutoGenerated')}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                placeholder="0.00"
                                                value={payment.amount}
                                                onChange={(e) => updatePaymentRow(index, 'amount', e.target.value)}
                                                className="w-24 h-8"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Select
                                                    value={payment.month}
                                                    onValueChange={(v) => updatePaymentRow(index, 'month', v)}
                                                >
                                                    <SelectTrigger className="w-24 h-8">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {MONTH_KEYS.map(m => (
                                                            <SelectItem key={m} value={m}>{tm(m)}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Select
                                                    value={payment.day}
                                                    onValueChange={(v) => updatePaymentRow(index, 'day', v)}
                                                >
                                                    <SelectTrigger className="w-16 h-8">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {getDaysInMonth(payment.month, payment.year).map(d => (
                                                            <SelectItem key={d} value={d}>{d}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Select
                                                    value={payment.year}
                                                    onValueChange={(v) => updatePaymentRow(index, 'year', v)}
                                                >
                                                    <SelectTrigger className="w-20 h-8">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {years.map(y => (
                                                            <SelectItem key={y} value={y}>{y}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Popover
                                                    open={openCalendarIndex === index}
                                                    onOpenChange={(open) => setOpenCalendarIndex(open ? index : null)}
                                                >
                                                    <PopoverTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                            <IconCalendar className="h-4 w-4" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-3" align="start">
                                                        <input
                                                            type="date"
                                                            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                                            value={`${payment.year}-${String(MONTH_KEYS.indexOf(payment.month) + 1).padStart(2, '0')}-${String(payment.day).padStart(2, '0')}`}
                                                            onChange={(e) => {
                                                                if (!e.target.value) return
                                                                const [y, m, d] = e.target.value.split('-')
                                                                handleCalendarSelect(index, new Date(parseInt(y), parseInt(m) - 1, parseInt(d)))
                                                            }}
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                placeholder=""
                                                value={payment.comment}
                                                onChange={(e) => updatePaymentRow(index, 'comment', e.target.value)}
                                                className="w-full h-8"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={payment.payment_method}
                                                onValueChange={(v) => updatePaymentRow(index, 'payment_method', v)}
                                            >
                                                <SelectTrigger className="w-32 h-8">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PAYMENT_METHOD_OPTIONS.map((opt) => (
                                                        <SelectItem key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Checkbox
                                                checked={payment.is_lunch_payment}
                                                onCheckedChange={(checked) => updatePaymentRow(index, 'is_lunch_payment', checked)}
                                            />
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <label className="cursor-pointer">
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0] || null
                                                        updatePaymentRow(index, 'file', file)
                                                    }}
                                                />
                                                <IconPlus className="h-4 w-4 mx-auto text-gray-500 hover:text-gray-700" />
                                            </label>
                                            {payment.file && (
                                                <span className="text-xs text-green-600 block">
                                                    {payment.file.name.substring(0, 10)}...
                                                </span>
                                            )}
                                        </TableCell>
                                        {viewMode === 'expanded' && (
                                            <>
                                                <TableCell>-</TableCell>
                                                <TableCell>-</TableCell>
                                            </>
                                        )}
                                        <TableCell>
                                            {newPayments.length > 1 && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => removePaymentRow(index)}
                                                >
                                                    <IconTrash className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Save Button (centered) */}
            <div className="flex justify-center">
                <Button 
                    className="bg-[#3d8fb5] hover:bg-[#357a9e] px-8"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? <IconLoader className="h-4 w-4 animate-spin mr-2" /> : null}
                    {t('codes_save')}
                </Button>
            </div>

            {/* Summary */}
            <Card className="border shadow-sm">
                <CardContent className="p-4">
                    <div className="space-y-1 text-end">
                        <div className="flex justify-end gap-4">
                            <span className="text-sm font-medium">{t('totalFees')}:</span>
                            <span className="text-sm w-24">{formatCurrency(summary.totalFees)}</span>
                        </div>
                        <div className="flex justify-end gap-4">
                            <span className="text-sm font-medium">{t('lessTotalPayments')}:</span>
                            <span className="text-sm w-24">{formatCurrency(summary.totalPayments)}</span>
                        </div>
                        <div className="flex justify-end gap-4">
                            <span className="text-sm font-bold">{t('balance')}:</span>
                            <span className="text-sm font-bold w-24">{formatCurrency(summary.balance)}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Back Link */}
            <div>
                <Link href="/admin/fees/payments" className="text-[#3d8fb5] hover:underline text-sm">
                    ← {t('backToStudents')}
                </Link>
            </div>

            {/* Hidden print template */}
            <div className="hidden">
                <div ref={printRef}>
                    {payments.map(payment => (
                        <div key={payment.id} className="receipt">
                            <div className="header">
                                <h1>{selectedCampus?.name || 'School Name'}</h1>
                                                        <p>{t('feeChallan')}</p>
                            </div>
                            <div className="info-grid">
                                <div>
                                    <p><strong>{t('student')}:</strong> {student ? `${student.first_name} ${student.last_name}` : '-'}</p>
                                    <p><strong>{t('istudentlyId')}:</strong> {student?.student_number || '-'}</p>
                                </div>
                                <div className="right">
                                    <p><strong>{t('th_receipt')}:</strong> {payment.receipt_number || `RCP-${payment.id.substring(0,8).toUpperCase()}`}</p>
                                    <p><strong>{t('paymentDate')}:</strong> {formatDate(payment.payment_date)}</p>
                                </div>
                            </div>
                            <div className="amount-box">
                                <p className="label">{t('amountPaid')}</p>
                                <p className="amount">{formatCurrency(payment.amount)}</p>
                            </div>
                            <table>
                                <tbody>
                                    <tr>
                                        <th>{t('th_comment')}</th>
                                        <td>{payment.comment || '-'}</td>
                                    </tr>
                                </tbody>
                            </table>
                            <div className="footer">
                                <div className="date">
                                    <p>{t('th_createdAt')}: {new Date().toLocaleDateString()}</p>
                                </div>
                                <div className="signature">
                                    <div className="signature-line">
                                        <p>{t('authorizedSignature')}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Hidden file input for uploading to existing payments */}
            <input
                ref={fileUploadRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file && uploadTargetPaymentId.current) {
                        handleUploadFileForPayment(uploadTargetPaymentId.current, file)
                    }
                    e.target.value = ''
                }}
            />
        </div>
        </>
    )
}
