'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useCampus } from '@/context/CampusContext'
import { useAcademic } from '@/context/AcademicContext'
import * as accountingApi from '@/lib/api/accounting'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { IconLoader, IconPrinter } from '@tabler/icons-react'
import { useTranslations } from 'next-intl'
import { useSchoolSettings } from '@/hooks/useSchoolSettings'

export default function CategoryRollupReportPage() {
    const t = useTranslations('admin.accounting.reports')
    const tCommon = useTranslations('common')
    const { selectedCampus, loading: campusLoading } = useCampus() || {}
    const { currentAcademicYear } = useAcademic()
    const campusId = selectedCampus?.id
    const academicYear = currentAcademicYear?.name || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
    const { formatCurrency } = useSchoolSettings()

    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const [startDate, setStartDate] = useState(monthStart.toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0])
    const [appliedFilters, setAppliedFilters] = useState({ startDate, endDate })

    const { data: rollup, isLoading } = useSWR(
        campusId ? ['category-rollup', campusId, academicYear, appliedFilters.startDate, appliedFilters.endDate] : null,
        () => accountingApi.getCategoryRollup(campusId!, academicYear, appliedFilters.startDate, appliedFilters.endDate),
        { revalidateOnFocus: false }
    )

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
                        <p className="text-muted-foreground text-center">{t('select_campus')}</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const incomeTotal = (rollup?.incomes || []).reduce((sum, r) => sum + r.total, 0)
    const expenseTotal = (rollup?.expenses || []).reduce((sum, r) => sum + r.total, 0)

    const renderTable = (rows: accountingApi.CategoryRollupRow[], emptyKey: string) => {
        if (rows.length === 0) {
            return <p className="text-muted-foreground text-sm py-4 text-center">{t(emptyKey)}</p>
        }
        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t('col_category')}</TableHead>
                        <TableHead className="text-right">{t('col_total')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.category_id || 'uncategorized'}>
                            <TableCell>{row.category_name}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(row.total)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        )
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
                    <p className="text-muted-foreground">{t('subtitle', { campus: selectedCampus.name })}</p>
                </div>
                <Button onClick={() => window.print()} variant="outline">
                    <IconPrinter className="h-4 w-4 mr-2" />
                    {tCommon('print')}
                </Button>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-medium">{t('period')}</span>
                        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
                        <span>{tCommon('to')}</span>
                        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
                        <Button
                            onClick={() => setAppliedFilters({ startDate, endDate })}
                            variant="default"
                            className="bg-[#3d8fb5] hover:bg-[#357ea0]"
                        >
                            {tCommon('view')}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-green-600">{t('incomes_by_category')}</CardTitle>
                            <span className="font-bold text-green-600">{formatCurrency(incomeTotal)}</span>
                        </CardHeader>
                        <CardContent>{renderTable(rollup?.incomes || [], 'no_income_data')}</CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-red-600">{t('expenses_by_category')}</CardTitle>
                            <span className="font-bold text-red-600">{formatCurrency(expenseTotal)}</span>
                        </CardHeader>
                        <CardContent>{renderTable(rollup?.expenses || [], 'no_expense_data')}</CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
