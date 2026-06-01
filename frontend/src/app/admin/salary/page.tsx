'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { useSalaryDashboardStats, useSalaryRecords, usePendingAdvances } from '@/hooks/useSalary'
import { formatMonthYear } from '@/lib/api/salary'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { IconCash, IconCheck, IconClock, IconSettings, IconUsers, IconArrowUp, IconRefresh } from '@tabler/icons-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useSchoolSettings } from '@/hooks/useSchoolSettings'

export default function SalaryPage() {
    const t = useTranslations('admin.salary.page')
    const tCommon = useTranslations('common')
    const { profile } = useAuth()
    const campusContext = useCampus()
    const schoolId = profile?.school_id || null
    const campusId = campusContext?.selectedCampus?.id

    const currentDate = new Date()
    const [month, setMonth] = useState(currentDate.getMonth() + 1)
    const [year, setYear] = useState(currentDate.getFullYear())
    const [statusFilter, setStatusFilter] = useState<string>('')
    const [page, setPage] = useState(1)
    const [refreshing, setRefreshing] = useState(false)

    const { data: stats, isLoading: statsLoading, mutate: mutateStats } = useSalaryDashboardStats(schoolId, month, year)
    const { data: salaryData, isLoading: salaryLoading, mutate: mutateSalary } = useSalaryRecords(schoolId, {
        month,
        year,
        status: statusFilter === 'all' ? undefined : statusFilter || undefined,
        page,
        limit: 10,
        campus_id: campusId
    })
    const { data: pendingAdvances, mutate: mutateAdvances } = usePendingAdvances(schoolId, campusId)
    const { formatCurrency } = useSchoolSettings()

    const handleRefresh = async () => {
        setRefreshing(true)
        toast.info(t('toast.refreshing'))
        try {
            await Promise.all([
                mutateStats(),
                mutateSalary(),
                mutateAdvances()
            ])
            toast.success(t('toast.refresh_success'))
        } catch (error) {
            toast.error(t('toast.refresh_error'))
        } finally {
            setRefreshing(false)
        }
    }

    const getStatusBadge = (status: string) => {
        const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
            pending: 'secondary',
            approved: 'outline',
            paid: 'default'
        }
        const colors: Record<string, string> = {
            pending: 'bg-yellow-100 text-yellow-800',
            approved: 'bg-blue-100 text-blue-800',
            paid: 'bg-green-100 text-green-800'
        }
        const labels: Record<string, string> = {
            pending: tCommon('pending'),
            approved: tCommon('approved'),
            paid: tCommon('paid')
        }
        return <Badge className={colors[status]}>{labels[status] || status}</Badge>
    }

    const months = Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: tCommon(`months.${i}`)
    }))

    const years = [2024, 2025, 2026, 2027]

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight dark:text-white">{t('title')}</h1>
                    <p className="text-muted-foreground">{t('subtitle')}</p>
                </div>
                <div className="flex gap-2">
                    <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={handleRefresh} 
                        disabled={refreshing}
                        title={t('actions.refresh')}
                    >
                        <IconRefresh className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button variant="outline" asChild>
                        <Link href="/admin/salary/settings">
                            <IconSettings className="mr-2 h-4 w-4" />
                            {t('actions.settings')}
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href="/admin/salary/generate">{t('actions.generate')}</Link>
                    </Button>
                </div>
            </div>

            {/* Month/Year Filter */}
            <div className="flex gap-4">
                <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder={t('filters.month')} />
                    </SelectTrigger>
                    <SelectContent>
                        {months.map((m) => (
                            <SelectItem key={m.value} value={m.value.toString()}>
                                {m.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                    <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder={t('filters.year')} />
                    </SelectTrigger>
                    <SelectContent>
                        {years.map((y) => (
                            <SelectItem key={y} value={y.toString()}>
                                {y}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('stats.total_payroll')}</CardTitle>
                        <IconUsers className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <Skeleton className="h-8 w-24" />
                        ) : (
                            <div className="text-2xl font-bold">{formatCurrency(stats?.total_payroll || 0)}</div>
                        )}
                        <p className="text-xs text-muted-foreground">{formatMonthYear(month, year)}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('stats.paid')}</CardTitle>
                        <IconCheck className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <Skeleton className="h-8 w-24" />
                        ) : (
                            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats?.total_paid || 0)}</div>
                        )}
                        <p className="text-xs text-muted-foreground">{t('stats.staff_count', { count: stats?.counts?.paid || 0 })}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('stats.pending')}</CardTitle>
                        <IconClock className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <Skeleton className="h-8 w-24" />
                        ) : (
                            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(stats?.total_pending || 0)}</div>
                        )}
                        <p className="text-xs text-muted-foreground">
                            {t('stats.staff_count', { count: (stats?.counts?.pending || 0) + (stats?.counts?.approved || 0) })}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('stats.advance_requests')}</CardTitle>
                        <IconArrowUp className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{pendingAdvances?.length || 0}</div>
                        <p className="text-xs text-muted-foreground">{t('stats.awaiting_approval')}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Salary Records Table */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('table.title')}</CardTitle>
                    <CardDescription>{t('table.description', { monthYear: formatMonthYear(month, year) })}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-4">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder={t('filters.all_statuses')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('filters.all_statuses')}</SelectItem>
                                <SelectItem value="pending">{tCommon('pending')}</SelectItem>
                                <SelectItem value="approved">{tCommon('approved')}</SelectItem>
                                <SelectItem value="paid">{tCommon('paid')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {salaryLoading ? (
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
                                        <TableHead>{t('table.employee')}</TableHead>
                                        <TableHead>{t('table.employee_number')}</TableHead>
                                        <TableHead>{t('table.job_title')}</TableHead>
                                        <TableHead>{t('table.base_salary')}</TableHead>
                                        <TableHead>{t('table.allowances')}</TableHead>
                                        <TableHead>{t('table.deductions')}</TableHead>
                                        <TableHead>{t('table.net_salary')}</TableHead>
                                        <TableHead>{tCommon('status')}</TableHead>
                                        <TableHead className="text-right">{tCommon('actions')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {salaryData?.data?.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                                {t('table.empty', { monthYear: formatMonthYear(month, year) })}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        salaryData?.data?.map((record) => (
                                            <TableRow key={record.id}>
                                                <TableCell className="font-medium">
                                                    {(record.staff as any)?.profile?.first_name} {(record.staff as any)?.profile?.last_name}
                                                </TableCell>
                                                <TableCell>{(record.staff as any)?.employee_number || tCommon('na')}</TableCell>
                                                <TableCell>{(record.staff as any)?.title || tCommon('na')}</TableCell>
                                                <TableCell>{formatCurrency(record.base_salary)}</TableCell>
                                                <TableCell className="text-green-600">
                                                    +{formatCurrency(record.total_allowances + record.attendance_bonus)}
                                                </TableCell>
                                                <TableCell className="text-red-600">
                                                    -{formatCurrency(record.total_deductions)}
                                                </TableCell>
                                                <TableCell className="font-bold">{formatCurrency(record.net_salary)}</TableCell>
                                                <TableCell>{getStatusBadge(record.status)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="sm" asChild>
                                                        <Link href={`/admin/salary/records/${record.id}`}>{tCommon('view')}</Link>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {/* Pagination */}
                    {salaryData?.pagination && salaryData.pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between px-2">
                            <p className="text-sm text-muted-foreground">
                                {t('pagination.showing', {
                                    start: (page - 1) * 10 + 1,
                                    end: Math.min(page * 10, salaryData.pagination.total),
                                    total: salaryData.pagination.total
                                })}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(1)}
                                    disabled={page === 1}
                                >
                                    {t('pagination.first')}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                >
                                    {tCommon('previous')}
                                </Button>
                                <span className="text-sm font-medium">
                                    {tCommon('page_x_of_y', { current: page, total: salaryData.pagination.totalPages })}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={page >= salaryData.pagination.totalPages}
                                >
                                    {tCommon('next')}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(salaryData.pagination.totalPages)}
                                    disabled={page >= salaryData.pagination.totalPages}
                                >
                                    {t('pagination.last')}
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
