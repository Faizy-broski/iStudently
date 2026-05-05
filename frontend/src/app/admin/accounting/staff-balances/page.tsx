'use client'

import { useState, useMemo } from 'react'
import { useCampus } from '@/context/CampusContext'
import { useAcademic } from '@/context/AcademicContext'
import * as accountingApi from '@/lib/api/accounting'
import * as salaryApi from '@/lib/api/salary'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { IconLoader, IconPrinter } from '@tabler/icons-react'
import useSWR from 'swr'
import { format } from 'date-fns'
import { getAllStaff, Staff } from '@/lib/api/staff'
import { useTranslations } from 'next-intl'
import { useSchoolSettings } from '@/hooks/useSchoolSettings'

const MONTHS = [
    { value: '01', monthKey: '0' },
    { value: '02', monthKey: '1' },
    { value: '03', monthKey: '2' },
    { value: '04', monthKey: '3' },
    { value: '05', monthKey: '4' },
    { value: '06', monthKey: '5' },
    { value: '07', monthKey: '6' },
    { value: '08', monthKey: '7' },
    { value: '09', monthKey: '8' },
    { value: '10', monthKey: '9' },
    { value: '11', monthKey: '10' },
    { value: '12', monthKey: '11' },
]

const getDaysInMonth = (month: string, year: string) => {
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate()
    return Array.from({ length: daysInMonth }, (_, i) => ({
        value: String(i + 1).padStart(2, '0'),
        label: String(i + 1)
    }))
}

const getYears = () => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 10 }, (_, i) => ({
        value: String(currentYear - 5 + i),
        label: String(currentYear - 5 + i)
    }))
}

interface StaffBalance {
    staff_id: string
    staff_name: string
    designation?: string
    total_salary_due: number
    total_salary_paid: number
    salary_count: number
    manual_payments: number
    manual_payment_count: number
    balance: number
    last_payment_date?: string
}

export default function StaffBalancesPage() {
    const t = useTranslations('admin.accounting.staff_balances')
    const tCommon = useTranslations('common')
    const { selectedCampus, loading: campusLoading } = useCampus() || {}
    const { currentAcademicYear } = useAcademic()
    const campusId = selectedCampus?.id
    const schoolId = selectedCampus?.parent_school_id || campusId
    const academicYear = currentAcademicYear?.name || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
    const { formatCurrency } = useSchoolSettings()

    const today = new Date()
    const [startMonth, setStartMonth] = useState('N/A')
    const [startDay, setStartDay] = useState('N/A')
    const [startYear, setStartYear] = useState('N/A')
    const [endMonth, setEndMonth] = useState(String(today.getMonth() + 1).padStart(2, '0'))
    const [endDay, setEndDay] = useState(String(today.getDate()).padStart(2, '0'))
    const [endYear, setEndYear] = useState(String(today.getFullYear()))
    const [appliedFilters, setAppliedFilters] = useState<{ startDate?: string; endDate?: string }>({
        endDate: format(today, 'yyyy-MM-dd')
    })

    const { data: staffPayments, isLoading: paymentsLoading } = useSWR(
        campusId ? ['accounting-staff-payments-balances', campusId, academicYear, appliedFilters.startDate, appliedFilters.endDate] : null,
        () => accountingApi.getStaffPayments(campusId!, academicYear, appliedFilters.startDate, appliedFilters.endDate),
        { revalidateOnFocus: false }
    )

    const { data: salaryRecordsData, isLoading: salariesLoading } = useSWR(
        schoolId && campusId ? ['salary-records-balances', campusId] : null,
        () => salaryApi.getSalaryRecords(schoolId!, { campus_id: campusId!, limit: 1000 }),
        { revalidateOnFocus: false }
    )

    const { data: staffResponse } = useSWR(
        campusId ? ['staff-list-balances', campusId] : null,
        async () => getAllStaff(1, 1000, undefined, 'employees', campusId!),
        { revalidateOnFocus: false }
    )

    const isLoading = paymentsLoading || salariesLoading

    const staffBalances = useMemo(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const staffList: Staff[] = Array.isArray((staffResponse as any)?.data?.data) ? (staffResponse as any).data.data : []
        const salaryRecords = salaryRecordsData?.data || []
        if (staffList.length === 0) return []

        const balanceMap = new Map<string, StaffBalance>()

        staffList.forEach((staff: Staff) => {
            balanceMap.set(staff.id, {
                staff_id: staff.id,
                staff_name: `${staff.profile?.first_name || ''} ${staff.profile?.last_name || ''}`,
                designation: staff.title || undefined,
                total_salary_due: 0,
                total_salary_paid: 0,
                salary_count: 0,
                manual_payments: 0,
                manual_payment_count: 0,
                balance: 0
            })
        })

        salaryRecords.forEach(record => {
            const existing = balanceMap.get(record.staff_id)
            if (existing) {
                existing.total_salary_due += Number(record.net_salary || 0)
                existing.salary_count += 1
                if (record.status === 'paid') {
                    existing.total_salary_paid += Number(record.net_salary || 0)
                    if (record.payment_date) {
                        const paymentDate = record.payment_date.split('T')[0]
                        if (!existing.last_payment_date || paymentDate > existing.last_payment_date) {
                            existing.last_payment_date = paymentDate
                        }
                    }
                }
            }
        })

        staffPayments?.forEach(payment => {
            if (payment.staff_id) {
                const existing = balanceMap.get(payment.staff_id)
                if (existing) {
                    existing.manual_payments += payment.amount
                    existing.manual_payment_count += 1
                    if (!existing.last_payment_date || payment.payment_date > existing.last_payment_date) {
                        existing.last_payment_date = payment.payment_date
                    }
                }
            }
        })

        balanceMap.forEach(sb => {
            sb.balance = sb.total_salary_due - sb.total_salary_paid - sb.manual_payments
        })

        return Array.from(balanceMap.values()).sort((a, b) => b.balance - a.balance)
    }, [staffResponse, staffPayments, salaryRecordsData])

    const handleApplyFilters = () => {
        let startDate: string | undefined
        let endDate: string | undefined
        if (startYear !== 'N/A' && startMonth !== 'N/A' && startDay !== 'N/A') {
            startDate = `${startYear}-${startMonth}-${startDay}`
        }
        if (endYear !== 'N/A' && endMonth !== 'N/A' && endDay !== 'N/A') {
            endDate = `${endYear}-${endMonth}-${endDay}`
        }
        setAppliedFilters({ startDate, endDate })
    }

    const totalSalaryDue = useMemo(() => staffBalances.reduce((sum, sb) => sum + sb.total_salary_due, 0), [staffBalances])
    const totalSalaryPaid = useMemo(() => staffBalances.reduce((sum, sb) => sum + sb.total_salary_paid, 0), [staffBalances])
    const totalManualPayments = useMemo(() => staffBalances.reduce((sum, sb) => sum + sb.manual_payments, 0), [staffBalances])
    const totalBalance = useMemo(() => staffBalances.reduce((sum, sb) => sum + sb.balance, 0), [staffBalances])
    const staffWithSalaries = useMemo(() => staffBalances.filter(sb => sb.salary_count > 0).length, [staffBalances])

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
                    <div className="flex items-center gap-4 flex-wrap">
                        <span className="font-medium">{t('period')}</span>
                        <div className="flex items-center gap-2">
                            <Select value={startMonth} onValueChange={setStartMonth}>
                                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="N/A">N/A</SelectItem>
                                    {MONTHS.map(m => (
                                        <SelectItem key={m.value} value={m.value}>{tCommon(`months.${m.monthKey}`)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={startDay} onValueChange={setStartDay}>
                                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="N/A">N/A</SelectItem>
                                    {getDaysInMonth(startMonth === 'N/A' ? '01' : startMonth, startYear === 'N/A' ? String(today.getFullYear()) : startYear).map(d => (
                                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={startYear} onValueChange={setStartYear}>
                                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="N/A">N/A</SelectItem>
                                    {getYears().map(y => (
                                        <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <span>{tCommon('to')}</span>
                        <div className="flex items-center gap-2">
                            <Select value={endMonth} onValueChange={setEndMonth}>
                                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {MONTHS.map(m => (
                                        <SelectItem key={m.value} value={m.value}>{tCommon(`months.${m.monthKey}`)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={endDay} onValueChange={setEndDay}>
                                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {getDaysInMonth(endMonth, endYear).map(d => (
                                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={endYear} onValueChange={setEndYear}>
                                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {getYears().map(y => (
                                        <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleApplyFilters} variant="default" className="bg-[#3d8fb5] hover:bg-[#357ea0]">
                            {tCommon('view')}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>{t('card_total_staff')}</CardDescription>
                        <CardTitle className="text-2xl">{staffBalances.length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>{t('card_with_salaries')}</CardDescription>
                        <CardTitle className="text-2xl">{staffWithSalaries}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>{t('card_total_paid')}</CardDescription>
                        <CardTitle className="text-2xl text-green-600">{formatCurrency(totalSalaryPaid)}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>{t('card_total_balance')}</CardDescription>
                        <CardTitle className={`text-2xl ${totalBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(totalBalance)}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('table_title')}</CardTitle>
                    <CardDescription>{t('table_desc')}</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : staffBalances.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">{t('empty')}</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('col_name')}</TableHead>
                                    <TableHead>{t('col_title')}</TableHead>
                                    <TableHead className="text-right">{t('col_salary_due')}</TableHead>
                                    <TableHead className="text-right">{t('col_salary_paid')}</TableHead>
                                    <TableHead className="text-right">{t('col_manual')}</TableHead>
                                    <TableHead className="text-right">{t('col_balance')}</TableHead>
                                    <TableHead>{tCommon('status')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {staffBalances.map(sb => (
                                    <TableRow key={sb.staff_id}>
                                        <TableCell className="font-medium">{sb.staff_name}</TableCell>
                                        <TableCell>{sb.designation || '-'}</TableCell>
                                        <TableCell className="text-right">
                                            {sb.total_salary_due > 0 ? formatCurrency(sb.total_salary_due) : <span className="text-muted-foreground">{formatCurrency(0)}</span>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {sb.total_salary_paid > 0 ? <span className="text-green-600">{formatCurrency(sb.total_salary_paid)}</span> : <span className="text-muted-foreground">{formatCurrency(0)}</span>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {sb.manual_payments > 0 ? <span className="text-blue-600">{formatCurrency(sb.manual_payments)}</span> : <span className="text-muted-foreground">{formatCurrency(0)}</span>}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">
                                            {sb.balance > 0 ? (
                                                <span className="text-red-600">{formatCurrency(sb.balance)}</span>
                                            ) : sb.balance < 0 ? (
                                                <span className="text-green-600">{formatCurrency(sb.balance)}</span>
                                            ) : (
                                                <span className="text-muted-foreground">{formatCurrency(0)}</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {sb.balance <= 0 ? (
                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{t('status_paid')}</Badge>
                                            ) : sb.total_salary_paid > 0 || sb.manual_payments > 0 ? (
                                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">{t('status_partial')}</Badge>
                                            ) : sb.salary_count > 0 ? (
                                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{t('status_pending')}</Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200">{t('status_no_salary')}</Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardContent className="pt-6">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span>{t('footer_total_generated')}</span>
                            <span className="font-medium">{formatCurrency(totalSalaryDue)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span>{t('footer_total_paid')}</span>
                            <span className="font-medium text-green-600">{formatCurrency(totalSalaryPaid)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span>{t('footer_total_manual')}</span>
                            <span className="font-medium text-blue-600">{formatCurrency(totalManualPayments)}</span>
                        </div>
                        <div className="flex justify-between items-center text-lg font-semibold border-t pt-2">
                            <span>{t('footer_total_balance')}</span>
                            <span className={totalBalance > 0 ? 'text-red-600' : 'text-green-600'}>{formatCurrency(totalBalance)}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
