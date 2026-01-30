'use client'

import useSWR from 'swr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { IconArrowLeft, IconCash, IconAlertTriangle } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { API_URL } from '@/config/api'

const fetcher = async (url: string) => {
    const token = localStorage.getItem('auth_token')
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error)
    return data.data
}

export default function ParentFeesPage() {
    const { data, isLoading, error } = useSWR(`${API_URL}/parents/my/children/fees`, fetcher)

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

    const getStatusBadge = (status: string, balance: number, dueDate: string) => {
        const isOverdue = balance > 0 && new Date(dueDate) < new Date()
        if (status === 'paid' || balance === 0) return <Badge className="bg-green-500">Paid</Badge>
        if (status === 'overdue' || isOverdue) return <Badge variant="destructive">Overdue</Badge>
        if (status === 'partial') return <Badge className="bg-amber-500">Partial</Badge>
        return <Badge variant="secondary">Pending</Badge>
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/parent/dashboard"><IconArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight dark:text-white">Children's Fees</h1>
                    <p className="text-muted-foreground">View fee status for all your children</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                                <IconCash className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total Due</p>
                                <p className="text-2xl font-bold">{formatCurrency(data?.totalDue || 0)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                                <IconAlertTriangle className="h-6 w-6 text-red-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Overdue</p>
                                <p className="text-2xl font-bold">{formatCurrency(data?.totalOverdue || 0)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                                <IconCash className="h-6 w-6 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total Fees</p>
                                <p className="text-2xl font-bold">{data?.fees?.length || 0}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Fees by Child */}
            {data?.children?.map((child: any) => (
                <Card key={child.id}>
                    <CardHeader>
                        <CardTitle>{child.name}</CardTitle>
                        <CardDescription>{child.grade_level || 'Grade not assigned'}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {child.fees?.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fee</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Paid</TableHead>
                                        <TableHead>Balance</TableHead>
                                        <TableHead>Due Date</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {child.fees.map((fee: any) => (
                                        <TableRow key={fee.id}>
                                            <TableCell className="font-medium">{fee.fee_structure?.name || 'N/A'}</TableCell>
                                            <TableCell>{fee.fee_structure?.category?.name || '-'}</TableCell>
                                            <TableCell>{formatCurrency(fee.final_amount)}</TableCell>
                                            <TableCell className="text-green-600">{formatCurrency(fee.amount_paid)}</TableCell>
                                            <TableCell className="font-bold">{formatCurrency(fee.balance)}</TableCell>
                                            <TableCell>{new Date(fee.due_date).toLocaleDateString()}</TableCell>
                                            <TableCell>{getStatusBadge(fee.status, fee.balance, fee.due_date)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <p className="text-center text-muted-foreground py-4">No fees assigned</p>
                        )}
                    </CardContent>
                </Card>
            ))}

            {isLoading && <p className="text-center py-8">Loading...</p>}
            {error && <p className="text-center text-red-500 py-8">{error.message}</p>}
        </div>
    )
}
