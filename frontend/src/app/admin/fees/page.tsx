'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { useFeeDashboardStats } from '@/hooks/useFees'
import { useSchoolSettings } from '@/hooks/useSchoolSettings'
import { getBalanceDisplay, StudentFee, getFeesByGrade } from '@/lib/api/fees'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { IconCash, IconReceipt, IconAlertCircle, IconCheck, IconSettings, IconAdjustments, IconFileText, IconRefresh, IconChevronLeft, IconChevronRight, IconEdit, IconLoader } from '@tabler/icons-react'
import Link from 'next/link'
import FeeAdjustmentModal from '@/components/admin/FeeAdjustmentModal'
import FeeChallanModal from '@/components/admin/FeeChallanModal'
import StudentFeeOverrideModal from '@/components/admin/StudentFeeOverrideModal'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'

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

export default function FeesPage() {
    const t = useTranslations('admin.fees.page')
    const tCommon = useTranslations('common')
    const { profile } = useAuth()
    const { selectedCampus } = useCampus()
    const { formatCurrency, isLoading: settingsLoading } = useSchoolSettings()
    const schoolId = selectedCampus?.id || profile?.school_id || null

    // Filter states
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [gradeLevelId, setGradeLevelId] = useState<string>('all')
    const [sectionId, setSectionId] = useState<string>('all')
    const [feeMonth, setFeeMonth] = useState<string>('all')
    
    // Pagination states
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    
    const [selectedFee, setSelectedFee] = useState<StudentFee | null>(null)
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false)
    const [isChallanModalOpen, setIsChallanModalOpen] = useState(false)
    const [challanFeeId, setChallanFeeId] = useState<string | null>(null)
    const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false)
    const [selectedStudentForOverride, setSelectedStudentForOverride] = useState<{
        id: string
        student_number?: string
        profiles: { first_name: string; last_name: string }
        grade_levels?: { name: string }
    } | null>(null)
    const [isRefreshing, setIsRefreshing] = useState(false)

    // Fee data state
    const [feesData, setFeesData] = useState<{ data: StudentFee[]; pagination: any } | null>(null)
    const [feesLoading, setFeesLoading] = useState(false)

    const { data: stats, isLoading: statsLoading } = useFeeDashboardStats(schoolId)

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

    // Load fees when filters change
    useEffect(() => {
        if (schoolId) {
            loadFees()
        }
    }, [schoolId, gradeLevelId, sectionId, feeMonth, statusFilter, page, pageSize])

    const loadFees = async () => {
        setFeesLoading(true)
        try {
            const data = await getFeesByGrade({
                schoolId: schoolId || undefined,
                gradeLevelId: gradeLevelId === 'all' ? undefined : gradeLevelId,
                sectionId: sectionId === 'all' ? undefined : sectionId,
                feeMonth: feeMonth === 'all' ? undefined : feeMonth,
                status: statusFilter === 'all' ? undefined : statusFilter,
                page,
                limit: pageSize
            })
            setFeesData(data)
        } catch (error) {
            console.error('Failed to load fees:', error)
        } finally {
            setFeesLoading(false)
        }
    }

    const refreshFees = async () => {
        await loadFees()
    }

    // Reset section when grade changes
    useEffect(() => {
        setSectionId('all')
    }, [gradeLevelId])

    // Reset page when filters change
    useEffect(() => {
        setPage(1)
    }, [gradeLevelId, sectionId, feeMonth, statusFilter, pageSize])

    // Local formatCurrency is removed in favor of the one from useSchoolSettings

    const getStatusBadge = (status: string) => {
        const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
            pending: 'secondary',
            partial: 'outline',
            paid: 'default',
            overdue: 'destructive',
            waived: 'secondary'
        }
        const labels: Record<string, string> = {
            pending: tCommon('pending'),
            partial: t('status.partial'),
            paid: tCommon('paid'),
            overdue: t('status.overdue'),
            waived: t('status.waived')
        }
        return <Badge variant={variants[status] || 'secondary'}>{labels[status] || status}</Badge>
    }

    const handleAdjustFee = (fee: StudentFee) => {
        setSelectedFee(fee)
        setIsAdjustModalOpen(true)
    }

    const handleAdjustmentComplete = () => {
        refreshFees()
    }

    const handleViewChallan = (feeId: string) => {
        setChallanFeeId(feeId)
        setIsChallanModalOpen(true)
    }

    const handleSetFeeOverride = (fee: StudentFee) => {
        if (fee.students) {
            setSelectedStudentForOverride({
                id: fee.student_id,
                student_number: fee.students.student_number,
                profiles: fee.students.profiles,
                grade_levels: (fee.students as any).grade_levels
            })
            setIsOverrideModalOpen(true)
        }
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
                    <p className="text-muted-foreground">{t('subtitle')}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/admin/fees/settings">
                            <IconSettings className="mr-2 h-4 w-4" />
                            {t('actions.settings')}
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href="/admin/fees/generate">{t('actions.generate')}</Link>
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('stats.total_fees')}</CardTitle>
                        <IconReceipt className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <Skeleton className="h-8 w-24" />
                        ) : (
                            <div className="text-2xl font-bold">{formatCurrency(stats?.total_fees || 0)}</div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('stats.collected')}</CardTitle>
                        <IconCheck className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <Skeleton className="h-8 w-24" />
                        ) : (
                            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats?.total_collected || 0)}</div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('stats.pending')}</CardTitle>
                        <IconCash className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <Skeleton className="h-8 w-24" />
                        ) : (
                            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(stats?.total_pending || 0)}</div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('stats.overdue')}</CardTitle>
                        <IconAlertCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <Skeleton className="h-8 w-24" />
                        ) : (
                            <div className="text-2xl font-bold text-red-600">{formatCurrency(stats?.total_overdue || 0)}</div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('table.title')}</CardTitle>
                    <CardDescription>{t('table.description')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-3 items-end">
                        {/* Grade Level Filter */}
                        <div className="min-w-[150px]">
                            <label className="text-xs text-muted-foreground mb-1 block">{tCommon('grade_level')}</label>
                            <Select value={gradeLevelId} onValueChange={setGradeLevelId}>
                                <SelectTrigger>
                                    <SelectValue placeholder={tCommon('all_grades')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{tCommon('all_grades')}</SelectItem>
                                    {gradeLevels?.sort((a, b) => a.order_index - b.order_index).map((grade) => (
                                        <SelectItem key={grade.id} value={grade.id}>{grade.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Section Filter */}
                        <div className="min-w-[150px]">
                            <label className="text-xs text-muted-foreground mb-1 block">{tCommon('section')}</label>
                            <Select 
                                value={sectionId} 
                                onValueChange={setSectionId}
                                disabled={gradeLevelId === 'all'}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={tCommon('all_sections')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{tCommon('all_sections')}</SelectItem>
                                    {sections?.map((section) => (
                                        <SelectItem key={section.id} value={section.id}>{section.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Fee Month Filter */}
                        <div className="min-w-[150px]">
                            <label className="text-xs text-muted-foreground mb-1 block">{t('filters.fee_month')}</label>
                            <Select value={feeMonth} onValueChange={setFeeMonth}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t('filters.all_months')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('filters.all_months')}</SelectItem>
                                    <SelectItem value="January">{tCommon('months.0')}</SelectItem>
                                    <SelectItem value="February">{tCommon('months.1')}</SelectItem>
                                    <SelectItem value="March">{tCommon('months.2')}</SelectItem>
                                    <SelectItem value="April">{tCommon('months.3')}</SelectItem>
                                    <SelectItem value="May">{tCommon('months.4')}</SelectItem>
                                    <SelectItem value="June">{tCommon('months.5')}</SelectItem>
                                    <SelectItem value="July">{tCommon('months.6')}</SelectItem>
                                    <SelectItem value="August">{tCommon('months.7')}</SelectItem>
                                    <SelectItem value="September">{tCommon('months.8')}</SelectItem>
                                    <SelectItem value="October">{tCommon('months.9')}</SelectItem>
                                    <SelectItem value="November">{tCommon('months.10')}</SelectItem>
                                    <SelectItem value="December">{tCommon('months.11')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Status Filter */}
                        <div className="min-w-[150px]">
                            <label className="text-xs text-muted-foreground mb-1 block">{tCommon('status')}</label>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t('filters.all_statuses')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('filters.all_statuses')}</SelectItem>
                                    <SelectItem value="pending">{tCommon('pending')}</SelectItem>
                                    <SelectItem value="partial">{t('status.partial')}</SelectItem>
                                    <SelectItem value="paid">{tCommon('paid')}</SelectItem>
                                    <SelectItem value="overdue">{t('status.overdue')}</SelectItem>
                                    <SelectItem value="waived">{t('status.waived')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Refresh Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isRefreshing}
                            onClick={async () => {
                                setIsRefreshing(true)
                                try {
                                    await refreshFees()
                                } catch (error) {
                                    console.error('Error refreshing fee data:', error)
                                } finally {
                                    setIsRefreshing(false)
                                }
                            }}
                            title={t('actions.refresh')}
                            className="h-9"
                        >
                            <IconRefresh className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>

                    {/* Fees Table */}
                    {feesLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{tCommon('student')}</TableHead>
                                        <TableHead>{t('table.fee_type')}</TableHead>
                                        <TableHead>{tCommon('amount')}</TableHead>
                                        <TableHead>{tCommon('paid')}</TableHead>
                                        <TableHead>{tCommon('balance')}</TableHead>
                                        <TableHead>{t('table.due_date')}</TableHead>
                                        <TableHead>{tCommon('status')}</TableHead>
                                        <TableHead className="text-right">{tCommon('actions')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {feesData?.data?.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                                {t('table.empty')}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        feesData?.data?.map((fee) => {
                                            const balance = getBalanceDisplay(fee.amount_paid, fee.final_amount)
                                            return (
                                                <TableRow key={fee.id}>
                                                    <TableCell className="font-medium">
                                                        {fee.students?.profiles?.first_name} {fee.students?.profiles?.last_name}
                                                        <span className="block text-xs text-muted-foreground">
                                                            {fee.students?.student_number}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>{fee.fee_structures?.fee_categories?.name}</TableCell>
                                                    <TableCell>{formatCurrency(fee.final_amount)}</TableCell>
                                                    <TableCell className="text-green-600">{formatCurrency(fee.amount_paid)}</TableCell>
                                                    <TableCell className={balance.color}>{formatCurrency(parseFloat(balance.value))}</TableCell>
                                                    <TableCell>{new Date(fee.due_date).toLocaleDateString()}</TableCell>
                                                    <TableCell>{getStatusBadge(fee.status)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex gap-1 justify-end">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleSetFeeOverride(fee)}
                                                                title={t('actions.override')}
                                                            >
                                                                <IconEdit className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleAdjustFee(fee)}
                                                                title={t('actions.adjust')}
                                                            >
                                                                <IconAdjustments className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleViewChallan(fee.id)}
                                                                title={t('actions.view_challan')}
                                                            >
                                                                <IconFileText className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {/* Pagination */}
                    <div className="flex items-center justify-between pt-4 border-t">
                        <div className="flex items-center gap-4">
                            <p className="text-sm text-muted-foreground">
                                {feesData?.pagination ? (
                                    <>{t('pagination.showing', { start: (page - 1) * pageSize + 1, end: Math.min(page * pageSize, feesData.pagination.total), total: feesData.pagination.total })}</>
                                ) : (
                                    t('pagination.no_records')
                                )}
                            </p>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">{tCommon('perPage')}:</span>
                                <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(parseInt(v))}>
                                    <SelectTrigger className="w-[70px] h-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="20">20</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >
                                <IconChevronLeft className="h-4 w-4 mr-1" />
                                {tCommon('previous')}
                            </Button>
                            <span className="text-sm px-2">
                                {tCommon('page_x_of_y', { current: page, total: feesData?.pagination?.totalPages || 1 })}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => p + 1)}
                                disabled={!feesData?.pagination || page >= feesData.pagination.totalPages}
                            >
                                {tCommon('next')}
                                <IconChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Fee Adjustment Modal */}
            {selectedFee && (
                <FeeAdjustmentModal
                    isOpen={isAdjustModalOpen}
                    onClose={() => {
                        setIsAdjustModalOpen(false)
                        setSelectedFee(null)
                    }}
                    fee={selectedFee}
                    onAdjusted={handleAdjustmentComplete}
                    schoolId={schoolId || undefined}
                />
            )}

            {/* Fee Challan Modal */}
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

            {/* Student Fee Override Modal */}
            {selectedStudentForOverride && schoolId && (
                <StudentFeeOverrideModal
                    isOpen={isOverrideModalOpen}
                    onClose={() => {
                        setIsOverrideModalOpen(false)
                        setSelectedStudentForOverride(null)
                    }}
                    student={selectedStudentForOverride}
                    schoolId={schoolId}
                    onUpdated={refreshFees}
                />
            )}
        </div>
    )
}
