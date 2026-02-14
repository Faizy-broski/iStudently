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
import { IconLoader, IconSearch, IconPrinter, IconFileText, IconFilter, IconRefresh } from '@tabler/icons-react'
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

interface StudentFee {
    id: string
    student_id: string
    final_amount: number
    amount_paid: number
    balance: number
    status: string
    due_date: string
    fee_month?: string
    academic_year?: string
    fee_breakdown?: { items?: Array<{ name?: string; category?: string; amount?: number }> }
    students: {
        id: string
        student_number: string
        grade_level: string
        profiles: {
            first_name: string
            last_name: string
        }
        grade_levels?: {
            name: string
        }
        sections?: {
            name: string
        }
    }
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

async function fetchFees(schoolId: string, params: { gradeId?: string; sectionId?: string; search?: string }): Promise<StudentFee[]> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    const queryParams = new URLSearchParams({ school_id: schoolId, limit: '500' })
    if (params.gradeId && params.gradeId !== 'all') queryParams.append('grade_level_id', params.gradeId)
    if (params.sectionId && params.sectionId !== 'all') queryParams.append('section_id', params.sectionId)
    
    const res = await fetch(`${API_BASE}/api/fees/by-grade?${queryParams}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
    })
    const json = await res.json()
    return json.success ? json.data : []
}

export default function PrintInvoicesPage() {
    const { selectedCampus, loading: campusLoading } = useCampus() || {}
    const schoolId = selectedCampus?.id

    const [gradeId, setGradeId] = useState<string>('all')
    const [sectionId, setSectionId] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedFees, setSelectedFees] = useState<Set<string>>(new Set())
    const [selectAll, setSelectAll] = useState(false)
    const [dateFrom, setDateFrom] = useState<string>('')
    const [dateTo, setDateTo] = useState<string>('')
    const [minBalance, setMinBalance] = useState<string>('')
    const [maxBalance, setMaxBalance] = useState<string>('')
    
    const printRef = useRef<HTMLDivElement>(null)

    // Fetch grades
    const { data: grades } = useSWR<GradeLevel[]>(
        schoolId ? ['grades', schoolId] : null,
        () => fetchGrades(schoolId!)
    )

    // Fetch sections when grade changes
    const { data: sections } = useSWR<Section[]>(
        gradeId && gradeId !== 'all' ? `sections-invoices-${gradeId}` : null,
        () => fetchSections(gradeId)
    )

    // Fetch fees
    const { data: fees, isLoading } = useSWR<StudentFee[]>(
        schoolId ? ['fees-invoices', schoolId, gradeId, sectionId] : null,
        () => fetchFees(schoolId!, { gradeId, sectionId })
    )

    // Filter fees by search, date range, and balance range
    const filteredFees = fees?.filter(fee => {
        // Search filter
        if (searchQuery) {
            const student = fee.students
            const name = `${student.profiles.first_name} ${student.profiles.last_name}`.toLowerCase()
            if (!name.includes(searchQuery.toLowerCase()) && 
                !student.student_number?.toLowerCase().includes(searchQuery.toLowerCase())) {
                return false
            }
        }
        // Date range filter (due_date)
        if (dateFrom && fee.due_date < dateFrom) return false
        if (dateTo && fee.due_date > dateTo) return false
        // Balance range filter
        const balanceValue = fee.balance || 0
        if (minBalance && balanceValue < parseFloat(minBalance)) return false
        if (maxBalance && balanceValue > parseFloat(maxBalance)) return false
        return true
    }) || []

    // Reset filters
    const handleResetFilters = () => {
        setGradeId('all')
        setSectionId('all')
        setSearchQuery('')
        setDateFrom('')
        setDateTo('')
        setMinBalance('')
        setMaxBalance('')
        setSelectedFees(new Set())
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
    const formatStudentName = (student: StudentFee['students']) => {
        const { first_name, last_name } = student.profiles
        return `${first_name} ${last_name}`
    }

    // Handle select all
    const handleSelectAll = (checked: boolean) => {
        setSelectAll(checked)
        if (checked) {
            setSelectedFees(new Set(filteredFees.map(f => f.id)))
        } else {
            setSelectedFees(new Set())
        }
    }

    // Handle individual select
    const handleSelect = (feeId: string, checked: boolean) => {
        const newSelected = new Set(selectedFees)
        if (checked) {
            newSelected.add(feeId)
        } else {
            newSelected.delete(feeId)
        }
        setSelectedFees(newSelected)
        setSelectAll(newSelected.size === filteredFees.length)
    }

    // Get selected fees for printing
    const feesToPrint = filteredFees.filter(f => selectedFees.has(f.id))

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
                <title>Fee Invoices</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .invoice { border: 2px solid #333; padding: 24px; margin-bottom: 32px; page-break-after: always; }
                    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 16px; margin-bottom: 16px; }
                    .header h1 { font-size: 24px; margin-bottom: 4px; }
                    .header p { color: #666; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
                    .info-grid .right { text-align: right; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
                    th, td { border: 1px solid #333; padding: 8px; text-align: left; }
                    th { background: #f0f0f0; }
                    .text-right { text-align: right; }
                    .font-bold { font-weight: bold; }
                    .text-red { color: #dc2626; }
                    .footer { text-align: center; font-size: 12px; color: #666; border-top: 1px solid #333; padding-top: 16px; }
                    @media print { .invoice:last-child { page-break-after: auto; } }
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
                <IconFileText className="h-8 w-8 text-[#3d8fb5]" />
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Print Invoices</h1>
                    <p className="text-muted-foreground">Print fee vouchers for students</p>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <IconFilter className="h-5 w-5" />
                        Filter Invoices
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
                                disabled={selectedFees.size === 0}
                                className="bg-[#3d8fb5] hover:bg-[#357a9e] w-full"
                            >
                                <IconPrinter className="h-4 w-4 mr-2" />
                                Print Selected ({selectedFees.size})
                            </Button>
                        </div>
                    </div>
                    {/* Row 2: Date Range, Balance Range */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>Due Date From</Label>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Due Date To</Label>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Min Balance</Label>
                            <Input
                                type="number"
                                placeholder="0"
                                value={minBalance}
                                onChange={(e) => setMinBalance(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Max Balance</Label>
                            <Input
                                type="number"
                                placeholder="Any"
                                value={maxBalance}
                                onChange={(e) => setMaxBalance(e.target.value)}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Fees Table */}
            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredFees.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No fees found.</p>
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
                                    <TableHead className="text-[#3d8fb5]">FEE MONTH</TableHead>
                                    <TableHead className="text-[#3d8fb5] text-right">AMOUNT</TableHead>
                                    <TableHead className="text-[#3d8fb5] text-right">BALANCE</TableHead>
                                    <TableHead className="text-[#3d8fb5]">DUE DATE</TableHead>
                                    <TableHead className="text-[#3d8fb5]">STATUS</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredFees.map((fee, index) => (
                                    <TableRow 
                                        key={fee.id}
                                        className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                                    >
                                        <TableCell>
                                            <Checkbox 
                                                checked={selectedFees.has(fee.id)}
                                                onCheckedChange={(checked) => handleSelect(fee.id, checked as boolean)}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {formatStudentName(fee.students)}
                                        </TableCell>
                                        <TableCell>{fee.students.student_number || '-'}</TableCell>
                                        <TableCell>{fee.students.grade_levels?.name || '-'}</TableCell>
                                        <TableCell>{fee.fee_month || '-'}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(fee.final_amount)}</TableCell>
                                        <TableCell className="text-right font-medium text-red-600">
                                            {formatCurrency(fee.balance)}
                                        </TableCell>
                                        <TableCell>{fee.due_date ? formatDate(fee.due_date) : '-'}</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                fee.status === 'paid' ? 'bg-green-100 text-green-800' :
                                                fee.status === 'overdue' ? 'bg-red-100 text-red-800' :
                                                fee.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {fee.status?.toUpperCase()}
                                            </span>
                                        </TableCell>
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
                    {feesToPrint.map((fee) => (
                        <div key={fee.id} className="invoice">
                            {/* Invoice Header */}
                            <div className="header">
                                <h1>{selectedCampus?.name || 'School Name'}</h1>
                                <p>FEE INVOICE / VOUCHER</p>
                            </div>

                            {/* Student Info */}
                            <div className="info-grid">
                                <div>
                                    <p><strong>Student Name:</strong> {formatStudentName(fee.students)}</p>
                                    <p><strong>Student ID:</strong> {fee.students.student_number || '-'}</p>
                                    <p><strong>Grade:</strong> {fee.students.grade_levels?.name || '-'}</p>
                                </div>
                                <div className="right">
                                    <p><strong>Invoice #:</strong> INV-{fee.id.substring(0, 8).toUpperCase()}</p>
                                    <p><strong>Fee Month:</strong> {fee.fee_month || '-'}</p>
                                    <p><strong>Due Date:</strong> {fee.due_date ? formatDate(fee.due_date) : '-'}</p>
                                </div>
                            </div>

                            {/* Fee Details */}
                            <table>
                                <thead>
                                    <tr>
                                        <th>Description</th>
                                        <th className="text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fee.fee_breakdown?.items?.map((item: { name?: string; category?: string; amount?: number }, i: number) => (
                                        <tr key={i}>
                                            <td>{item.name || item.category}</td>
                                            <td className="text-right">{formatCurrency(item.amount || 0)}</td>
                                        </tr>
                                    )) || (
                                        <tr>
                                            <td>Tuition Fee</td>
                                            <td className="text-right">{formatCurrency(fee.final_amount)}</td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="font-bold">
                                        <td>Total Amount</td>
                                        <td className="text-right">{formatCurrency(fee.final_amount)}</td>
                                    </tr>
                                    <tr>
                                        <td>Amount Paid</td>
                                        <td className="text-right">{formatCurrency(fee.amount_paid)}</td>
                                    </tr>
                                    <tr className="font-bold text-red">
                                        <td>Balance Due</td>
                                        <td className="text-right">{formatCurrency(fee.balance)}</td>
                                    </tr>
                                </tfoot>
                            </table>

                            {/* Footer */}
                            <div className="footer">
                                <p>Please pay by the due date to avoid late fees.</p>
                                <p>Generated on: {new Date().toLocaleDateString()}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
