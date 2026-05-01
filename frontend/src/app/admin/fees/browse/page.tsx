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
                schoolId: schoolId || undefined,
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
        const labels: Record<string, string> = {
            pending: 'قيد الانتظار',
            partial: 'جزئي',
            paid: 'مدفوع',
            overdue: 'متأخر',
            waived: 'معفى'
        }
        return <Badge variant={variants[status] || 'secondary'}>{labels[status] || status}</Badge>
    }

    const formatCurrency = (amount: number) => {
        return `${amount?.toLocaleString() || 0}`
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
                    <h1 className="text-2xl font-bold">استعراض الرسوم حسب المرحلة</h1>
                    <p className="text-muted-foreground">عرض وإدارة الرسوم حسب المرحلة والفصل والشهر</p>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <IconFilter className="h-5 w-5" />
                        الفلاتر
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4">
                        <Select value={gradeLevelId} onValueChange={(v) => { setGradeLevelId(v); setSectionId('all') }}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="المرحلة الدراسية" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل المراحل</SelectItem>
                                {gradeLevels?.map((grade) => (
                                    <SelectItem key={grade.id} value={grade.id}>{grade.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={sectionId} onValueChange={setSectionId} disabled={gradeLevelId === 'all'}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="الفصل" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل الفصول</SelectItem>
                                {sections?.map((section) => (
                                    <SelectItem key={section.id} value={section.id}>{section.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={feeMonth} onValueChange={setFeeMonth}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="الشهر" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل الشهور</SelectItem>
                                {getMonthOptions().map((month) => (
                                    <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="الحالة" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل الحالات</SelectItem>
                                <SelectItem value="pending">قيد الانتظار</SelectItem>
                                <SelectItem value="partial">جزئي</SelectItem>
                                <SelectItem value="paid">مدفوع</SelectItem>
                                <SelectItem value="overdue">متأخر</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Fee Records */}
            <Card>
                <CardHeader>
                    <CardTitle>سجلات الرسوم</CardTitle>
                    <CardDescription>
                        {feesData?.pagination?.total || 0} سجل
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
                                        <TableHead>الطالب</TableHead>
                                        <TableHead>الشهر</TableHead>
                                        <TableHead>المبلغ</TableHead>
                                        <TableHead>المدفوع</TableHead>
                                        <TableHead>الرصيد</TableHead>
                                        <TableHead>تاريخ الاستحقاق</TableHead>
                                        <TableHead>الحالة</TableHead>
                                        <TableHead className="text-right">الإجراءات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {feesData?.data?.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                                لم يتم العثور على سجلات رسوم. جرّب تعديل الفلاتر.
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
                                                            title="عرض سجل الطالب"
                                                        >
                                                            <Link href={`/admin/students/${fee.student_id}/fees`}>
                                                                <IconUser className="h-4 w-4" />
                                                            </Link>
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleAdjustFee(fee)}
                                                            title="تعديل الرسوم"
                                                        >
                                                            <IconAdjustments className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleViewChallan(fee.id)}
                                                            title="عرض الإيصال"
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
                                الصفحة {page} من {feesData.pagination.totalPages}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                >
                                    السابق
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={page >= feesData.pagination.totalPages}
                                >
                                    التالي
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
                    schoolId={schoolId || undefined}
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
