'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { getFeesByGrade, StudentFee } from '@/lib/api/fees'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { IconFilter, IconAdjustments, IconFileText, IconUser } from '@tabler/icons-react'
import Link from 'next/link'
import FeeAdjustmentModal from '@/components/admin/FeeAdjustmentModal'
import FeeChallanModal from '@/components/admin/FeeChallanModal'
import useSWR from 'swr'

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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

export default function BrowseFeesByGradePage() {
    const { profile } = useAuth()
    const { selectedCampus } = useCampus()
    const schoolId = selectedCampus?.id || profile?.school_id || ''

    const [gradeLevelId, setGradeLevelId] = useState<string>('all')
    const [sectionId, setSectionId] = useState<string>('all')
    const [feeMonth, setFeeMonth] = useState<string>('all')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [page, setPage] = useState(1)

    const [feesData, setFeesData] = useState<{ data: StudentFee[]; pagination: any } | null>(null)
    const [loading, setLoading] = useState(false)

    // Modal states
    const [selectedFee, setSelectedFee] = useState<StudentFee | null>(null)
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false)
    const [isChallanModalOpen, setIsChallanModalOpen] = useState(false)
    const [challanFeeId, setChallanFeeId] = useState<string | null>(null)

    // Fetch grade levels
    const { data: gradeLevels } = useSWR<GradeLevel[]>(
        schoolId ? `grade-levels-${schoolId}` : null,
        async () => {
            const { createClient } = await import('@/lib/supabase/client')
            const token = (await createClient().auth.getSession()).data.session?.access_token
            const res = await fetch(`${API_BASE}/api/academics/grades?school_id=${schoolId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const json = await res.json()
            return json.success ? json.data : []
        }
    )

    // Fetch sections for selected grade
    const { data: sections } = useSWR<Section[]>(
        gradeLevelId && gradeLevelId !== 'all' ? `sections-${gradeLevelId}` : null,
        async () => {
            const { createClient } = await import('@/lib/supabase/client')
            const token = (await createClient().auth.getSession()).data.session?.access_token
            const res = await fetch(`${API_BASE}/api/academics/sections?grade_level_id=${gradeLevelId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const json = await res.json()
            return json.success ? json.data : []
        }
    )

    useEffect(() => {
        if (schoolId) {
            loadFees()
        }
    }, [schoolId, gradeLevelId, sectionId, feeMonth, statusFilter, page])

    const loadFees = async () => {
        setLoading(true)
        try {
            const data = await getFeesByGrade({
                gradeLevelId: gradeLevelId === 'all' ? undefined : gradeLevelId,
                sectionId: sectionId === 'all' ? undefined : sectionId,
                feeMonth: feeMonth === 'all' ? undefined : feeMonth,
                status: statusFilter === 'all' ? undefined : statusFilter,
                page,
                limit: 30
            })
            setFeesData(data)
        } catch (error) {
            console.error('Failed to load fees:', error)
        } finally {
            setLoading(false)
        }
    }

    const getStatusBadge = (status: string) => {
        const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
            pending: 'secondary',
            partial: 'outline',
            paid: 'default',
            overdue: 'destructive',
            waived: 'secondary'
        }
        return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>
    }

    const formatCurrency = (amount: number) => {
        return `Rs. ${amount?.toLocaleString() || 0}`
    }

    const handleAdjustFee = (fee: StudentFee) => {
        setSelectedFee(fee)
        setIsAdjustModalOpen(true)
    }

    const handleViewChallan = (feeId: string) => {
        setChallanFeeId(feeId)
        setIsChallanModalOpen(true)
    }

    // Generate month options (last 12 months)
    const getMonthOptions = () => {
        const months = []
        const now = new Date()
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
            const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            months.push({ value, label })
        }
        return months
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Browse Fees by Grade</h1>
                    <p className="text-muted-foreground">View and manage fees by grade level, section, and month</p>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <IconFilter className="h-5 w-5" />
                        Filters
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4">
                        <Select value={gradeLevelId} onValueChange={(v) => { setGradeLevelId(v); setSectionId('all') }}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Grade Level" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Grades</SelectItem>
                                {gradeLevels?.map((grade) => (
                                    <SelectItem key={grade.id} value={grade.id}>{grade.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={sectionId} onValueChange={setSectionId} disabled={gradeLevelId === 'all'}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Section" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Sections</SelectItem>
                                {sections?.map((section) => (
                                    <SelectItem key={section.id} value={section.id}>{section.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={feeMonth} onValueChange={setFeeMonth}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Month" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Months</SelectItem>
                                {getMonthOptions().map((month) => (
                                    <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="partial">Partial</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="overdue">Overdue</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Fee Records */}
            <Card>
                <CardHeader>
                    <CardTitle>Fee Records</CardTitle>
                    <CardDescription>
                        {feesData?.pagination?.total || 0} records found
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {loading ? (
                        <div className="space-y-2">
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Student</TableHead>
                                        <TableHead>Month</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Paid</TableHead>
                                        <TableHead>Balance</TableHead>
                                        <TableHead>Due Date</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {feesData?.data?.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                                No fee records found. Try adjusting your filters.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        feesData?.data?.map((fee) => (
                                            <TableRow key={fee.id}>
                                                <TableCell className="font-medium">
                                                    {fee.students?.profiles?.first_name} {fee.students?.profiles?.last_name}
                                                    <span className="block text-xs text-muted-foreground">
                                                        {fee.students?.student_number}
                                                    </span>
                                                </TableCell>
                                                <TableCell>{(fee as any).fee_month || '-'}</TableCell>
                                                <TableCell>{formatCurrency(fee.final_amount)}</TableCell>
                                                <TableCell className="text-green-600">{formatCurrency(fee.amount_paid)}</TableCell>
                                                <TableCell className="text-red-600">
                                                    {formatCurrency(fee.final_amount - fee.amount_paid)}
                                                </TableCell>
                                                <TableCell>{new Date(fee.due_date).toLocaleDateString()}</TableCell>
                                                <TableCell>{getStatusBadge(fee.status)}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex gap-1 justify-end">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            asChild
                                                            title="View Student History"
                                                        >
                                                            <Link href={`/admin/students/${fee.student_id}/fees`}>
                                                                <IconUser className="h-4 w-4" />
                                                            </Link>
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleAdjustFee(fee)}
                                                            title="Adjust Fee"
                                                        >
                                                            <IconAdjustments className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleViewChallan(fee.id)}
                                                            title="View Challan"
                                                        >
                                                            <IconFileText className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {/* Pagination */}
                    {feesData?.pagination && feesData.pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                Page {page} of {feesData.pagination.totalPages}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={page >= feesData.pagination.totalPages}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Modals */}
            {selectedFee && (
                <FeeAdjustmentModal
                    isOpen={isAdjustModalOpen}
                    onClose={() => {
                        setIsAdjustModalOpen(false)
                        setSelectedFee(null)
                    }}
                    fee={selectedFee}
                    onAdjusted={loadFees}
                />
            )}

            {challanFeeId && schoolId && (
                <FeeChallanModal
                    isOpen={isChallanModalOpen}
                    onClose={() => {
                        setIsChallanModalOpen(false)
                        setChallanFeeId(null)
                    }}
                    feeId={challanFeeId}
                    schoolId={schoolId}
                />
            )}
        </div>
    )
}
