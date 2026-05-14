'use client'

import useSWR from 'swr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { IconArrowLeft, IconBook, IconAlertTriangle, IconCash } from '@tabler/icons-react'
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

export default function ParentLibraryPage() {
    const { data, isLoading, error } = useSWR(`${API_URL}/parents/my/children/library`, fetcher)

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

    const isOverdue = (dueDate: string) => new Date(dueDate) < new Date()

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/parent/dashboard"><IconArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Library Status</h1>
                    <p className="text-muted-foreground">View library loans and fines for your children</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                                <IconBook className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Active Loans</p>
                                <p className="text-2xl font-bold">{data?.loans?.length || 0}</p>
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
                                <p className="text-sm text-muted-foreground">Overdue Books</p>
                                <p className="text-2xl font-bold">{data?.overdueCount || 0}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                                <IconCash className="h-6 w-6 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Unpaid Fines</p>
                                <p className="text-2xl font-bold">{formatCurrency(data?.totalFines || 0)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Loans by Child */}
            {data?.children?.map((child: any) => (
                <Card key={child.id}>
                    <CardHeader>
                        <CardTitle>{child.name}</CardTitle>
                        <CardDescription>
                            {child.loans?.length || 0} active loans | {child.fines?.length || 0} unpaid fines
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Active Loans */}
                        {child.loans?.length > 0 && (
                            <div>
                                <h4 className="font-medium mb-2">Active Loans</h4>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Book</TableHead>
                                            <TableHead>Author</TableHead>
                                            <TableHead>Issue Date</TableHead>
                                            <TableHead>Due Date</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {child.loans.map((loan: any) => (
                                            <TableRow key={loan.id}>
                                                <TableCell className="font-medium">{loan.book_copy?.book?.title || 'N/A'}</TableCell>
                                                <TableCell>{loan.book_copy?.book?.author || '-'}</TableCell>
                                                <TableCell>{new Date(loan.issue_date).toLocaleDateString()}</TableCell>
                                                <TableCell>{new Date(loan.due_date).toLocaleDateString()}</TableCell>
                                                <TableCell>
                                                    {isOverdue(loan.due_date) ? (
                                                        <Badge variant="destructive">Overdue</Badge>
                                                    ) : (
                                                        <Badge variant="default">Active</Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {/* Unpaid Fines */}
                        {child.fines?.length > 0 && (
                            <div>
                                <h4 className="font-medium mb-2 text-red-600">Unpaid Fines</h4>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Book</TableHead>
                                            <TableHead>Reason</TableHead>
                                            <TableHead>Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {child.fines.map((fine: any) => (
                                            <TableRow key={fine.id}>
                                                <TableCell>{fine.loan?.book_copy?.book?.title || 'N/A'}</TableCell>
                                                <TableCell className="capitalize">{fine.fine_type?.replace(/_/g, ' ') || 'Library Fine'}</TableCell>
                                                <TableCell className="font-bold text-red-600">{formatCurrency(fine.amount)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {child.loans?.length === 0 && child.fines?.length === 0 && (
                            <p className="text-center text-muted-foreground py-4">No active loans or fines</p>
                        )}
                    </CardContent>
                </Card>
            ))}

            {isLoading && <p className="text-center py-8">Loading...</p>}
            {error && <p className="text-center text-red-500 py-8">{error.message}</p>}
        </div>
    )
}
