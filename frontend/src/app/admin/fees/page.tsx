'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { useFeeDashboardStats, useStudentFees } from '@/hooks/useFees'
import { getBalanceDisplay, StudentFee } from '@/lib/api/fees'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { IconCash, IconReceipt, IconAlertCircle, IconCheck, IconSettings, IconSearch, IconAdjustments, IconFileText, IconRefresh } from '@tabler/icons-react'
import Link from 'next/link'
import FeeAdjustmentModal from '@/components/admin/FeeAdjustmentModal'
import FeeChallanModal from '@/components/admin/FeeChallanModal'

export default function FeesPage() {
    const { profile } = useAuth()
    const { selectedCampus } = useCampus()
    const schoolId = selectedCampus?.id || profile?.school_id || null

    const [statusFilter, setStatusFilter] = useState<string>('')
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [selectedFee, setSelectedFee] = useState<StudentFee | null>(null)
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false)
    const [isChallanModalOpen, setIsChallanModalOpen] = useState(false)
    const [challanFeeId, setChallanFeeId] = useState<string | null>(null)
    const [isRefreshing, setIsRefreshing] = useState(false)

    const { data: stats, isLoading: statsLoading } = useFeeDashboardStats(schoolId)
    const { data: feesData, isLoading: feesLoading, mutate: refreshFees } = useStudentFees(schoolId, {
        status: statusFilter === 'all' ? undefined : statusFilter || undefined,
        page,
        limit: 20
    })

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
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

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Fee Management</h1>
                    <p className="text-muted-foreground">Manage student fees, discounts, and payments</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/admin/fees/browse">Browse by Grade</Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link href="/admin/fees/settings">
                            <IconSettings className="mr-2 h-4 w-4" />
                            Settings
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href="/admin/fees/generate">Generate Fees</Link>
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Fees</CardTitle>
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
                        <CardTitle className="text-sm font-medium">Collected</CardTitle>
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
                        <CardTitle className="text-sm font-medium">Pending</CardTitle>
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
                        <CardTitle className="text-sm font-medium">Overdue</CardTitle>
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
                    <CardTitle>Student Fees</CardTitle>
                    <CardDescription>View and manage all student fee records</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="relative flex-1 min-w-[200px]">
                            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by student name..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="partial">Partial</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="overdue">Overdue</SelectItem>
                                <SelectItem value="waived">Waived</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isRefreshing}
                            onClick={async () => {
                                console.log('Refreshing fee data...')
                                setIsRefreshing(true)
                                try {
                                    await refreshFees()
                                    console.log('Fee data refreshed successfully')
                                } catch (error) {
                                    console.error('Error refreshing fee data:', error)
                                } finally {
                                    setIsRefreshing(false)
                                }
                            }}
                            title="Refresh fee data"
                            className="flex items-center gap-2 whitespace-nowrap bg-blue-50 hover:bg-blue-100 border-blue-200 dark:bg-blue-950 dark:hover:bg-blue-900 dark:border-blue-800 dark:text-blue-100"
                        >
                            <IconRefresh className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">
                                {isRefreshing ? 'Refreshing...' : 'Refresh'}
                            </span>
                        </Button>
                    </div>

                    {/* Fees Table */}
                    {feesLoading ? (
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
                                        <TableHead>Fee Type</TableHead>
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
                                                No fee records found
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
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {/* Pagination */}
                    {feesData?.pagination && feesData.pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                Showing {(page - 1) * 20 + 1} - {Math.min(page * 20, feesData.pagination.total)} of {feesData.pagination.total}
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
        </div>
    )
}
