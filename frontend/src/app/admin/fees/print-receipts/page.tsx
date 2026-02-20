'use client'

import { useState, useRef, useCallback } from 'react'
import { useCampus } from '@/context/CampusContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { IconLoader, IconSearch, IconPrinter, IconReceipt, IconFilter, IconRefresh } from '@tabler/icons-react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface GradeLevel {
    id: string
    name: string
    order_index: number
}

interface Section {
    id: string
    name: string
    grade_level_id: string
}

interface Payment {
    id: string
    amount: number
    payment_date: string
    payment_method?: string
    comment?: string
    is_lunch_payment: boolean
    created_at: string
    receipt_number?: string
    created_by_profile?: {
        first_name: string
        last_name: string
    }
    student_fee_id: string
}

interface StudentWithPayments {
    id: string
    student_number: string
    profiles: {
        first_name: string
        last_name: string
    }
    grade_levels?: {
        id: string
        name: string
    }
    sections?: {
        name: string
    }
    payments: Payment[]
}

async function fetchGrades(schoolId: string): Promise<GradeLevel[]> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    const res = await fetch(`${API_BASE}/api/academics/grades?school_id=${schoolId}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
    })
    const json = await res.json()
    return json.success ? json.data : []
}

async function fetchSections(gradeId: string): Promise<Section[]> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    const res = await fetch(`${API_BASE}/api/academics/sections?grade_level_id=${gradeId}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
    })
    const json = await res.json()
    return json.success ? json.data : []
}

async function fetchStudentsWithPayments(schoolId: string, gradeId?: string, sectionId?: string): Promise<StudentWithPayments[]> {
    const supabase = createClient()
    
    // First get students
    let studentsQuery = supabase
        .from('students')
        .select(`
            id,
            student_number,
            profiles!inner(first_name, last_name),
            grade_levels(id, name),
            sections(name)
        `)
        .eq('school_id', schoolId)
        .order('student_number')
    
    if (gradeId && gradeId !== 'all') {
        studentsQuery = studentsQuery.eq('grade_level', gradeId)
    }
    if (sectionId && sectionId !== 'all') {
        studentsQuery = studentsQuery.eq('section', sectionId)
    }

    const { data: students, error: studentsError } = await studentsQuery

    if (studentsError || !students) return []

    // Get student fees for these students
    const studentIds = students.map(s => s.id)
    
    const { data: fees } = await supabase
        .from('student_fees')
        .select('id, student_id')
        .eq('school_id', schoolId)
        .in('student_id', studentIds)
    
    if (!fees || fees.length === 0) {
        return students.map(s => ({ ...s, payments: [] })) as unknown as StudentWithPayments[]
    }

    const feeIds = fees.map(f => f.id)
    const feeToStudent = new Map(fees.map(f => [f.id, f.student_id]))

    // Get payments for these fees
    const { data: payments } = await supabase
        .from('fee_payments')
        .select(`
            id,
            student_fee_id,
            amount,
            payment_date,
            payment_method,
            comment,
            is_lunch_payment,
            receipt_number,
            created_at,
            created_by_profile:created_by(first_name, last_name)
        `)
        .in('student_fee_id', feeIds)
        .order('payment_date', { ascending: false })

    // Map payments to students
    const studentPayments = new Map<string, Payment[]>()
    payments?.forEach(p => {
        const studentId = feeToStudent.get(p.student_fee_id)
        if (studentId) {
            if (!studentPayments.has(studentId)) {
                studentPayments.set(studentId, [])
            }
            studentPayments.get(studentId)!.push(p as unknown as Payment)
        }
    })

    return students.map(s => ({
        ...s,
        payments: studentPayments.get(s.id) || []
    })) as unknown as StudentWithPayments[]
}

export default function PrintReceiptsPage() {
    const { selectedCampus, loading: campusLoading } = useCampus() || {}
    const schoolId = selectedCampus?.id

    const [gradeId, setGradeId] = useState<string>('all')
    const [sectionId, setSectionId] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set())
    const [selectAll, setSelectAll] = useState(false)
    const [dateFrom, setDateFrom] = useState<string>('')
    const [dateTo, setDateTo] = useState<string>('')
    const [minAmount, setMinAmount] = useState<string>('')
    const [maxAmount, setMaxAmount] = useState<string>('')
    
    const printRef = useRef<HTMLDivElement>(null)

    // Fetch grades
    const { data: grades } = useSWR<GradeLevel[]>(
        schoolId ? ['grades-receipts', schoolId] : null,
        () => fetchGrades(schoolId!)
    )

    // Fetch sections when grade changes
    const { data: sections } = useSWR<Section[]>(
        gradeId && gradeId !== 'all' ? `sections-receipts-${gradeId}` : null,
        () => fetchSections(gradeId)
    )

    // Fetch students with payments
    const { data: studentsWithPayments, isLoading } = useSWR<StudentWithPayments[]>(
        schoolId ? ['students-payments-receipts', schoolId, gradeId, sectionId] : null,
        () => fetchStudentsWithPayments(schoolId!, gradeId, sectionId)
    )

    // Flatten payments with student info for table display
    const allPayments = studentsWithPayments?.flatMap(student => 
        student.payments.map(payment => ({
            ...payment,
            student
        }))
    ) || []

    // Filter payments by search, date range, and amount range
    const filteredPayments = allPayments.filter(p => {
        // Search filter
        if (searchQuery) {
            const name = `${p.student.profiles.first_name} ${p.student.profiles.last_name}`.toLowerCase()
            const receipt = (p.receipt_number || '').toLowerCase()
            const idNum = p.student.student_number?.toLowerCase() || ''
            if (!name.includes(searchQuery.toLowerCase()) && 
                !idNum.includes(searchQuery.toLowerCase()) &&
                !receipt.includes(searchQuery.toLowerCase())) {
                return false
            }
        }
        // Date range filter (payment_date)
        if (dateFrom && p.payment_date < dateFrom) return false
        if (dateTo && p.payment_date > dateTo) return false
        // Amount range filter
        const amountValue = p.amount || 0
        if (minAmount && amountValue < parseFloat(minAmount)) return false
        if (maxAmount && amountValue > parseFloat(maxAmount)) return false
        return true
    })

    // Reset filters
    const handleResetFilters = () => {
        setGradeId('all')
        setSectionId('all')
        setSearchQuery('')
        setDateFrom('')
        setDateTo('')
        setMinAmount('')
        setMaxAmount('')
        setSelectedPayments(new Set())
        setSelectAll(false)
    }

    // Format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount)
    }

    // Format date
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        })
    }

    // Format student name
    const formatStudentName = (student: StudentWithPayments) => {
        const { first_name, last_name } = student.profiles
        return `${first_name} ${last_name}`
    }

    // Handle select all
    const handleSelectAll = (checked: boolean) => {
        setSelectAll(checked)
        if (checked) {
            setSelectedPayments(new Set(filteredPayments.map(p => p.id)))
        } else {
            setSelectedPayments(new Set())
        }
    }

    // Handle individual select
    const handleSelect = (paymentId: string, checked: boolean) => {
        const newSelected = new Set(selectedPayments)
        if (checked) {
            newSelected.add(paymentId)
        } else {
            newSelected.delete(paymentId)
        }
        setSelectedPayments(newSelected)
        setSelectAll(newSelected.size === filteredPayments.length)
    }

    // Get selected payments for printing
    const paymentsToPrint = filteredPayments.filter(p => selectedPayments.has(p.id))

    // Print handler using native window.print
    const handlePrint = useCallback(() => {
        const printContent = printRef.current
        if (!printContent) return

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
            <body>${printContent.innerHTML}</body>
            </html>
        `)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => {
            printWindow.print()
            printWindow.close()
        }, 250)
    }, [])

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
                        <p className="text-muted-foreground text-center">Please select a campus.</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <IconReceipt className="h-8 w-8 text-[#3d8fb5]" />
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Print Receipts</h1>
                    <p className="text-muted-foreground">Print payment receipts for students</p>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <IconFilter className="h-5 w-5" />
                        Filter Payments
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                        <IconRefresh className="h-4 w-4 mr-1" />
                        Reset
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Row 1: Grade, Section, Search */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>Grade Level</Label>
                            <Select value={gradeId} onValueChange={(v) => { setGradeId(v); setSectionId('all') }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Grades" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Grades</SelectItem>
                                    {grades?.map(g => (
                                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Section</Label>
                            <Select value={sectionId} onValueChange={setSectionId} disabled={gradeId === 'all'}>
                                <SelectTrigger>
                                    <SelectValue placeholder={gradeId === 'all' ? 'Select grade first' : 'All Sections'} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Sections</SelectItem>
                                    {sections?.map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Search Student</Label>
                            <div className="relative">
                                <Input
                                    placeholder="Name or ID..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pr-8"
                                />
                                <IconSearch className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            </div>
                        </div>
                        <div className="flex items-end">
                            <Button 
                                onClick={() => handlePrint()}
                                disabled={selectedPayments.size === 0}
                                className="bg-[#3d8fb5] hover:bg-[#357a9e] w-full"
                            >
                                <IconPrinter className="h-4 w-4 mr-2" />
                                Print Selected ({selectedPayments.size})
                            </Button>
                        </div>
                    </div>
                    {/* Row 2: Date Range, Amount Range */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>Payment Date From</Label>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Payment Date To</Label>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Min Amount</Label>
                            <Input
                                type="number"
                                placeholder="0"
                                value={minAmount}
                                onChange={(e) => setMinAmount(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Max Amount</Label>
                            <Input
                                type="number"
                                placeholder="Any"
                                value={maxAmount}
                                onChange={(e) => setMaxAmount(e.target.value)}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Payments Table */}
            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredPayments.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No payments found.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-100">
                                    <TableHead className="w-12">
                                        <Checkbox 
                                            checked={selectAll}
                                            onCheckedChange={handleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead className="text-[#3d8fb5]">STUDENT</TableHead>
                                    <TableHead className="text-[#3d8fb5]">ID</TableHead>
                                    <TableHead className="text-[#3d8fb5]">GRADE</TableHead>
                                    <TableHead className="text-[#3d8fb5]">PAYMENT DATE</TableHead>
                                    <TableHead className="text-[#3d8fb5]">RECEIPT #</TableHead>
                                    <TableHead className="text-[#3d8fb5] text-right">AMOUNT</TableHead>
                                    <TableHead className="text-[#3d8fb5]">METHOD</TableHead>
                                    <TableHead className="text-[#3d8fb5]">COMMENT</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPayments.map((payment, index) => (
                                    <TableRow 
                                        key={payment.id}
                                        className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                                    >
                                        <TableCell>
                                            <Checkbox 
                                                checked={selectedPayments.has(payment.id)}
                                                onCheckedChange={(checked) => handleSelect(payment.id, checked as boolean)}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {formatStudentName(payment.student)}
                                        </TableCell>
                                        <TableCell>{payment.student.student_number || '-'}</TableCell>
                                        <TableCell>{payment.student.grade_levels?.name || '-'}</TableCell>
                                        <TableCell>{formatDate(payment.payment_date)}</TableCell>
                                        <TableCell>{payment.receipt_number || '-'}</TableCell>
                                        <TableCell className="text-right font-medium text-green-600">
                                            {formatCurrency(payment.amount)}
                                        </TableCell>
                                        <TableCell>{payment.payment_method || 'Cash'}</TableCell>
                                        <TableCell className="max-w-50 truncate">{payment.comment || '-'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Print Template (Hidden) */}
            <div className="hidden">
                <div ref={printRef}>
                    {paymentsToPrint.map((payment) => (
                        <div key={payment.id} className="receipt">
                            {/* Receipt Header */}
                            <div className="header">
                                <h1>{selectedCampus?.name || 'School Name'}</h1>
                                <p>PAYMENT RECEIPT</p>
                            </div>

                            {/* Receipt Info */}
                            <div className="info-grid">
                                <div>
                                    <p><strong>Student Name:</strong> {formatStudentName(payment.student)}</p>
                                    <p><strong>Student ID:</strong> {payment.student.student_number || '-'}</p>
                                    <p><strong>Grade:</strong> {payment.student.grade_levels?.name || '-'}</p>
                                </div>
                                <div className="right">
                                    <p><strong>Receipt #:</strong> {payment.receipt_number || `RCP-${payment.id.substring(0, 8).toUpperCase()}`}</p>
                                    <p><strong>Payment Date:</strong> {formatDate(payment.payment_date)}</p>
                                    <p><strong>Method:</strong> {payment.payment_method || 'Cash'}</p>
                                </div>
                            </div>

                            {/* Payment Amount */}
                            <div className="amount-box">
                                <p className="label">Amount Paid</p>
                                <p className="amount">{formatCurrency(payment.amount)}</p>
                            </div>

                            {/* Additional Details */}
                            <table>
                                <tbody>
                                    <tr>
                                        <th>Payment Type</th>
                                        <td>{payment.is_lunch_payment ? 'Lunch Payment' : 'Fee Payment'}</td>
                                    </tr>
                                    {payment.comment && (
                                        <tr>
                                            <th>Comment</th>
                                            <td>{payment.comment}</td>
                                        </tr>
                                    )}
                                    {payment.created_by_profile && (
                                        <tr>
                                            <th>Received By</th>
                                            <td>{payment.created_by_profile.first_name} {payment.created_by_profile.last_name}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {/* Footer */}
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
