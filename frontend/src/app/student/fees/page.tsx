'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { IconReceipt, IconAlertTriangle, IconCheck, IconClock } from '@tabler/icons-react'
import { API_URL } from '@/config/api'
import { createClient } from '@/lib/supabase/client'

const fetcher = async (url: string) => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    
    if (!token) {
        throw new Error('Authentication required. Please sign in again.')
    }
    
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error)
    return data.data
}

interface StudentFee {
    id: string
    fee_month: string
    due_date: string
    base_amount: number
    services_amount: number
    discount_amount: number
    late_fee_applied: number
    final_amount: number
    amount_paid: number
    balance: number
    status: 'pending' | 'partial' | 'paid' | 'overdue' | 'waived'
    fee_category?: { name: string; code: string }
}

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
        pending: { variant: 'secondary', icon: IconClock },
        partial: { variant: 'outline', icon: IconClock },
        paid: { variant: 'default', icon: IconCheck },
        overdue: { variant: 'destructive', icon: IconAlertTriangle },
        waived: { variant: 'secondary', icon: IconCheck }
    }
    const { variant, icon: Icon } = variants[status] || variants.pending
    return (
        <Badge variant={variant} className="flex items-center gap-1 w-fit">
            <Icon className="h-3 w-3" />
            <span className="capitalize">{status}</span>
        </Badge>
    )
}

export default function StudentFeesPage() {
    const { data: fees, isLoading, error } = useSWR<StudentFee[]>(`${API_URL}/fees/my`, fetcher)
    const [tab, setTab] = useState<'all' | 'pending' | 'paid'>('all')

    const filteredFees = fees?.filter(fee => {
        if (tab === 'pending') return ['pending', 'partial', 'overdue'].includes(fee.status)
        if (tab === 'paid') return fee.status === 'paid'
        return true
    }) || []

    const totalDue = fees?.reduce((sum, f) => sum + f.balance, 0) || 0
    const totalPaid = fees?.reduce((sum, f) => sum + f.amount_paid, 0) || 0
    const totalFees = fees?.reduce((sum, f) => sum + f.final_amount, 0) || 0
    const overdueCount = fees?.filter(f => f.status === 'overdue').length || 0

    if (error) {
        return (
            <div className="container mx-auto py-6">
                <Card className="border-destructive">
                    <CardContent className="pt-6">
                        <p className="text-destructive">Failed to load fees: {error.message}</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight dark:text-white">My Fees</h1>
                <p className="text-muted-foreground">View your fee statements and payment history</p>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Fees</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{formatCurrency(totalFees)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Amount Paid</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
                        <Progress value={totalFees > 0 ? (totalPaid / totalFees) * 100 : 0} className="mt-2 h-2" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Balance Due</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className={`text-2xl font-bold ${totalDue > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                            {formatCurrency(totalDue)}
                        </p>
                    </CardContent>
                </Card>
                <Card className={overdueCount > 0 ? 'border-destructive bg-destructive/5' : ''}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className={`text-2xl font-bold ${overdueCount > 0 ? 'text-destructive' : ''}`}>
                            {overdueCount}
                        </p>
                        {overdueCount > 0 && (
                            <p className="text-xs text-destructive mt-1">Please pay immediately</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Fees Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <IconReceipt className="h-5 w-5" />
                        Fee History
                    </CardTitle>
                    <CardDescription>Your monthly fee statements</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                        <TabsList>
                            <TabsTrigger value="all">All Fees</TabsTrigger>
                            <TabsTrigger value="pending">Pending</TabsTrigger>
                            <TabsTrigger value="paid">Paid</TabsTrigger>
                        </TabsList>

                        <div className="mt-4">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Month</TableHead>
                                        <TableHead>Due Date</TableHead>
                                        <TableHead className="text-right">Base Fee</TableHead>
                                        <TableHead className="text-right">Services</TableHead>
                                        <TableHead className="text-right">Discount</TableHead>
                                        <TableHead className="text-right">Late Fee</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right">Paid</TableHead>
                                        <TableHead className="text-right">Balance</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                                                Loading...
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredFees.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                                                No fees found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredFees.map((fee) => (
                                            <TableRow key={fee.id}>
                                                <TableCell className="font-medium">{fee.fee_month}</TableCell>
                                                <TableCell>{formatDate(fee.due_date)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(fee.base_amount)}</TableCell>
                                                <TableCell className="text-right">
                                                    {fee.services_amount > 0 ? formatCurrency(fee.services_amount) : '-'}
                                                </TableCell>
                                                <TableCell className="text-right text-green-600">
                                                    {fee.discount_amount > 0 ? `-${formatCurrency(fee.discount_amount)}` : '-'}
                                                </TableCell>
                                                <TableCell className="text-right text-orange-600">
                                                    {fee.late_fee_applied > 0 ? `+${formatCurrency(fee.late_fee_applied)}` : '-'}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">{formatCurrency(fee.final_amount)}</TableCell>
                                                <TableCell className="text-right text-green-600">{formatCurrency(fee.amount_paid)}</TableCell>
                                                <TableCell className="text-right font-medium">
                                                    <span className={fee.balance > 0 ? 'text-orange-600' : 'text-green-600'}>
                                                        {formatCurrency(fee.balance)}
                                                    </span>
                                                </TableCell>
                                                <TableCell>{getStatusBadge(fee.status)}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    )
}
