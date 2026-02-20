'use client'

import { useState, useRef, useCallback, use } from 'react'
import { useCampus } from '@/context/CampusContext'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { IconLoader, IconPlus, IconTrash, IconCalendar } from '@tabler/icons-react'
import useSWR, { mutate } from 'swr'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Payment {
    id: string
    receipt_number?: string
    amount: number
    payment_date: string
    comment?: string
    is_lunch_payment: boolean
    file_url?: string
    created_at: string
    created_by_profile?: {
        first_name: string
        last_name: string
    }
}

interface PaymentResponse {
    payments: Payment[]
    summary: {
        totalFees: number
        totalPayments: number
        balance: number
    }
}

interface Student {
    id: string
    student_number: string
    profiles: {
        first_name: string
        last_name: string
    }
}

interface NewPayment {
    receipt_number?: string
    amount: string
    month: string
    day: string
    year: string
    comment: string
    is_lunch_payment: boolean
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

async function fetchStudent(studentId: string, schoolId: string): Promise<Student> {
    const supabase = createClient()
    const { data, error } = await supabase
        .from('students')
        .select('id, student_number, profiles!inner(first_name, last_name)')
        .eq('id', studentId)
        .eq('school_id', schoolId)
        .single()
    
    if (error) throw error
    return data as unknown as Student
}

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
]

const getDaysInMonth = (month: string, year: string) => {
    const monthIndex = MONTHS.indexOf(month) + 1 // 1-based
    const daysInMonth = new Date(parseInt(year), monthIndex, 0).getDate()
    return Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString())
}

export default function StudentPaymentsPage({ params }: { params: Promise<{ studentId: string }> }) {
    const resolvedParams = use(params)
    const studentId = resolvedParams.studentId
    
    const { selectedCampus, loading: campusLoading } = useCampus() || {}
    useAuth()
    const schoolId = selectedCampus?.id

    const [viewMode, setViewMode] = useState<'original' | 'expanded'>('original')
    const printRef = useRef<HTMLDivElement>(null)

    const handlePrint = useCallback(() => {
        const content = printRef.current
        if (!content) return

        const printWindow = window.open('', '_blank')
        if (!printWindow) return

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Payment Receipts</title>
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
    const [openCalendarIndex, setOpenCalendarIndex] = useState<number | null>(null)

    const handleCalendarSelect = (index: number, date: Date | undefined) => {
        if (!date) return
        const updated = [...newPayments]
        updated[index] = {
            ...updated[index],
            month: MONTHS[date.getMonth()],
            day: date.getDate().toString(),
            year: date.getFullYear().toString(),
        }
        setNewPayments(updated)
        setOpenCalendarIndex(null)
    }
    const [newPayments, setNewPayments] = useState<NewPayment[]>([{
        receipt_number: '',
        amount: '',
        month: MONTHS[new Date().getMonth()],
        day: new Date().getDate().toString(),
        year: new Date().getFullYear().toString(),
        comment: '',
        is_lunch_payment: false,
        file: null
    }])

    // Fetch student info
    const { data: student, isLoading: studentLoading } = useSWR(
        schoolId && studentId ? ['student-info', studentId, schoolId] : null,
        () => fetchStudent(studentId, schoolId!)
    )

    // Fetch payments
    const { data: paymentData, isLoading: paymentsLoading } = useSWR<PaymentResponse>(
        schoolId && studentId ? ['student-payments', studentId, schoolId] : null,
        () => fetchStudentPayments(studentId, schoolId!)
    )

    const payments = paymentData?.payments || []
    const summary = paymentData?.summary || { totalFees: 0, totalPayments: 0, balance: 0 }

    // Format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount)
    }

    // Format date
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    // Format student name
    const formatStudentName = () => {
        if (!student) return ''
        const { first_name, last_name } = student.profiles
        return `${first_name} ${last_name}`.toUpperCase()
    }

    // Add new payment row
    const addPaymentRow = () => {
        setNewPayments([...newPayments, {
            amount: '',
            month: MONTHS[new Date().getMonth()],
            day: new Date().getDate().toString(),
            year: new Date().getFullYear().toString(),
            comment: '',
            is_lunch_payment: false,
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

    // Save payments
    const handleSave = async () => {
        const validPayments = newPayments.filter(p => p.amount && parseFloat(p.amount) > 0)
        
        if (validPayments.length === 0) {
            toast.error('Please enter at least one payment amount')
            return
        }

        setSaving(true)
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()

        try {
            for (const payment of validPayments) {
                const monthIndex = MONTHS.indexOf(payment.month)
                const paymentDate = new Date(
                    parseInt(payment.year),
                    monthIndex,
                    parseInt(payment.day)
                ).toISOString()

                // TODO: Handle file upload if needed
                let fileUrl = undefined
                if (payment.file) {
                    // Upload file to storage
                    const fileName = `payments/${studentId}/${Date.now()}_${payment.file.name}`
                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from('attachments')
                        .upload(fileName, payment.file)
                    
                    if (!uploadError && uploadData) {
                        const { data: urlData } = supabase.storage
                            .from('attachments')
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
                        file_url: fileUrl,
                        receipt_number: payment.receipt_number || undefined
                    })
                })

                const json = await res.json()
                if (!json.success) throw new Error(json.error)
            }

            toast.success('Payments saved successfully')
            
            // Reset form and refresh data
            setNewPayments([{
                amount: '',
                month: MONTHS[new Date().getMonth()],
                day: new Date().getDate().toString(),
                year: new Date().getFullYear().toString(),
                comment: '',
                is_lunch_payment: false,
                file: null
            }])
            
            mutate(['student-payments', studentId, schoolId])
        } catch (error: unknown) {
            const err = error as Error
            toast.error(err.message || 'Failed to save payments')
        } finally {
            setSaving(false)
        }
    }

    // Delete existing payment
    const handleDeletePayment = async (paymentId: string) => {
        if (!confirm('Are you sure you want to delete this payment?')) return

        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()

        try {
            const res = await fetch(`${API_BASE}/api/fees/payments/${paymentId}?school_id=${schoolId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            })

            const json = await res.json()
            if (!json.success) throw new Error(json.error)

            toast.success('Payment deleted')
            mutate(['student-payments', studentId, schoolId])
        } catch (error: unknown) {
            const err = error as Error
            toast.error(err.message || 'Failed to delete payment')
        }
    }

    // Generate days for select
    // years list static
    const years = Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - 5 + i).toString())

    if (campusLoading || studentLoading) {
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
                        <p className="text-muted-foreground text-center">Please select a campus.</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-6 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <span className="text-3xl">🔔</span>
                <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
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
                    Print Receipt{payments.length > 1 ? 's' : ''}
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
                    {viewMode === 'original' ? 'Expanded View' : 'Original View'}
                </Link>
                <Button 
                    className="bg-[#3d8fb5] hover:bg-[#357a9e]"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? <IconLoader className="h-4 w-4 animate-spin mr-2" /> : null}
                    SAVE
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
                <p className="text-sm font-medium text-gray-700">No payments were found.</p>
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
                                    <TableHead className="text-[#3d8fb5] font-semibold">RECEIPT #</TableHead>
                                    <TableHead className="text-[#3d8fb5] font-semibold">AMOUNT</TableHead>
                                    <TableHead className="text-[#3d8fb5] font-semibold">DATE</TableHead>
                                    <TableHead className="text-[#3d8fb5] font-semibold">COMMENT</TableHead>
                                    <TableHead className="text-[#3d8fb5] font-semibold text-center">LUNCH PAYMENT</TableHead>
                                    <TableHead className="text-[#3d8fb5] font-semibold text-center">FILE ATTACHED</TableHead>
                                    {viewMode === 'expanded' && (
                                        <>
                                            <TableHead className="text-[#3d8fb5] font-semibold">CREATED BY</TableHead>
                                            <TableHead className="text-[#3d8fb5] font-semibold">CREATED AT</TableHead>
                                        </>
                                    )}
                                    <TableHead className="w-10"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {/* Existing Payments */}
                                {payments.map((payment, index) => (
                                    <TableRow 
                                        key={payment.id}
                                        className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                                    >
                                        <TableCell></TableCell>
                                        <TableCell>{payment.receipt_number || '-'}</TableCell>
                                        <TableCell>{formatCurrency(payment.amount)}</TableCell>
                                        <TableCell>{formatDate(payment.payment_date)}</TableCell>
                                        <TableCell>{payment.comment || '-'}</TableCell>
                                        <TableCell className="text-center">
                                            <Checkbox checked={payment.is_lunch_payment} disabled />
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {payment.file_url ? (
                                                <a 
                                                    href={payment.file_url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-[#3d8fb5] hover:underline"
                                                >
                                                    View
                                                </a>
                                            ) : '-'}
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
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => handleDeletePayment(payment.id)}
                                            >
                                                <IconTrash className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}

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
                                                value={payment.receipt_number}
                                                onChange={(e) => updatePaymentRow(index, 'receipt_number', e.target.value)}
                                                placeholder="Auto"
                                                className="w-24 h-8"
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
                                                        {MONTHS.map(m => (
                                                            <SelectItem key={m} value={m}>{m}</SelectItem>
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
                                                            value={`${payment.year}-${String(MONTHS.indexOf(payment.month) + 1).padStart(2, '0')}-${String(payment.day).padStart(2, '0')}`}
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
                    SAVE
                </Button>
            </div>

            {/* Summary */}
            <Card className="border shadow-sm">
                <CardContent className="p-4">
                    <div className="space-y-1 text-right">
                        <div className="flex justify-end gap-4">
                            <span className="text-sm font-medium">Total from Fees:</span>
                            <span className="text-sm w-24">{formatCurrency(summary.totalFees)}</span>
                        </div>
                        <div className="flex justify-end gap-4">
                            <span className="text-sm font-medium">Less: Total from Payments:</span>
                            <span className="text-sm w-24">{formatCurrency(summary.totalPayments)}</span>
                        </div>
                        <div className="flex justify-end gap-4">
                            <span className="text-sm font-bold">Balance:</span>
                            <span className="text-sm font-bold w-24">{formatCurrency(summary.balance)}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Back Link */}
            <div>
                <Link href="/admin/fees/payments" className="text-[#3d8fb5] hover:underline text-sm">
                    ← Back to Students
                </Link>
            </div>

            {/* Hidden print template */}
            <div className="hidden">
                <div ref={printRef}>
                    {payments.map(payment => (
                        <div key={payment.id} className="receipt">
                            <div className="header">
                                <h1>{selectedCampus?.name || 'School Name'}</h1>
                                <p>PAYMENT RECEIPT</p>
                            </div>
                            <div className="info-grid">
                                <div>
                                    <p><strong>Student Name:</strong> {student && `${student.profiles.first_name} ${student.profiles.last_name}`}</p>
                                    <p><strong>Student ID:</strong> {student?.student_number || '-'}</p>
                                </div>
                                <div className="right">
                                    <p><strong>Receipt #:</strong> {payment.receipt_number || `RCP-${payment.id.substring(0,8).toUpperCase()}`}</p>
                                    <p><strong>Payment Date:</strong> {formatDate(payment.payment_date)}</p>
                                </div>
                            </div>
                            <div className="amount-box">
                                <p className="label">Amount Paid</p>
                                <p className="amount">{formatCurrency(payment.amount)}</p>
                            </div>
                            <table>
                                <tbody>
                                    <tr>
                                        <th>Comment</th>
                                        <td>{payment.comment || '-'}</td>
                                    </tr>
                                </tbody>
                            </table>
                            <div className="footer">
                                <div className="date">
                                    <p>Generated on: {new Date().toLocaleDateString()}</p>
                                </div>
                                <div className="signature">
                                    <div className="signature-line">
                                        <p>Authorized Signature</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
