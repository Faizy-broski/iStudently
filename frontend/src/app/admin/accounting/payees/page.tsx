'use client'

import { useState, useMemo } from 'react'
import { useCampus } from '@/context/CampusContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { IconLoader, IconSearch, IconUsers, IconPlus, IconFileExport } from '@tabler/icons-react'
import { toast } from 'sonner'
import useSWR from 'swr'
import Link from 'next/link'
import * as accountingApi from '@/lib/api/accounting'
import type { Payee } from '@/lib/api/accounting'

export default function PayeesPage() {
    const { selectedCampus, loading: campusLoading } = useCampus() || {}
    const campusId = selectedCampus?.id

    const [searchQuery, setSearchQuery] = useState('')

    // Fetch payees list
    const { data: payeesResponse, isLoading } = useSWR(
        campusId ? ['payees-list', campusId] : null,
        () => accountingApi.getPayees(campusId!),
        { revalidateOnFocus: false }
    )

    const payees: Payee[] = useMemo(() => payeesResponse?.data || [], [payeesResponse?.data])

    // Filter payees by search
    const filteredPayees = useMemo(() => {
        if (!searchQuery) return payees
        const query = searchQuery.toLowerCase()
        return payees.filter(p => 
            p.name.toLowerCase().includes(query) ||
            p.email?.toLowerCase().includes(query) ||
            p.phone?.toLowerCase().includes(query)
        )
    }, [payees, searchQuery])

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
    }

    const handleExportPayments = () => {
        toast.info('Export functionality coming soon')
    }

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
                        <p className="text-muted-foreground text-center">Please select a campus to view payees.</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <IconUsers className="h-8 w-8 text-[#3d8fb5]" />
                    <h1 className="text-3xl font-bold tracking-tight">Payees</h1>
                </div>
                <Button 
                    variant="link" 
                    onClick={handleExportPayments}
                    className="text-[#3d8fb5]"
                >
                    Export Payments
                </Button>
            </div>

            {/* Count and Search */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            {filteredPayees.length} payee{filteredPayees.length !== 1 ? 's were' : ' was'} found.
                        </p>
                        <div className="relative">
                            <Input
                                placeholder="Search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-64 pr-8"
                            />
                            <IconSearch className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Payees Table */}
            <Card>
                <CardContent className="pt-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-[#3d8fb5]">NAME</TableHead>
                                    <TableHead className="text-[#3d8fb5]">EMAIL ADDRESS</TableHead>
                                    <TableHead className="text-[#3d8fb5]">PHONE NUMBER</TableHead>
                                    <TableHead className="text-[#3d8fb5]">BANK</TableHead>
                                    <TableHead className="text-[#3d8fb5] text-right">PAYMENTS</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPayees.map(payee => (
                                    <TableRow key={payee.id}>
                                        <TableCell>
                                            <Link 
                                                href={`/admin/accounting/payees/${payee.id}`}
                                                className="text-[#3d8fb5] hover:underline"
                                            >
                                                {payee.name}
                                            </Link>
                                        </TableCell>
                                        <TableCell>{payee.email || '-'}</TableCell>
                                        <TableCell>{payee.phone || '-'}</TableCell>
                                        <TableCell>{payee.bank || '-'}</TableCell>
                                        <TableCell className="text-right text-[#3d8fb5]">
                                            {formatCurrency(payee.total_payments || 0)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {/* Add a Payee Row */}
                                <TableRow>
                                    <TableCell colSpan={5}>
                                        <Link 
                                            href="/admin/accounting/payees/new"
                                            className="flex items-center gap-2 text-[#3d8fb5] hover:underline"
                                        >
                                            <IconPlus className="h-4 w-4" />
                                            ADD A PAYEE
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
