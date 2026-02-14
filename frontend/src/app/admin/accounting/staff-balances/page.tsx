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

const MONTHS = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
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
    // From salary_records (auto-generated)
    total_salary_due: number
    total_salary_paid: number
    salary_count: number
    // From accounting_payments (manual)
    manual_payments: number
    manual_payment_count: number
    // Calculated
    balance: number
    last_payment_date?: string
}

export default function StaffBalancesPage() {
    const { selectedCampus, loading: campusLoading } = useCampus() || {}
    const { currentAcademicYear } = useAcademic()
    const campusId = selectedCampus?.id
    const schoolId = selectedCampus?.parent_school_id || campusId
    const academicYear = currentAcademicYear?.name || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`

    // Date filter state
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

    // Fetch manual staff payments from accounting_payments
    const { data: staffPayments, isLoading: paymentsLoading } = useSWR(
        campusId ? ['accounting-staff-payments-balances', campusId, academicYear, appliedFilters.startDate, appliedFilters.endDate] : null,
        () => accountingApi.getStaffPayments(campusId!, academicYear, appliedFilters.startDate, appliedFilters.endDate),
        { revalidateOnFocus: false }
    )

    // Fetch salary records (auto-generated salaries from Salary module)
    const { data: salaryRecordsData, isLoading: salariesLoading } = useSWR(
        schoolId && campusId ? ['salary-records-balances', campusId] : null,
        () => salaryApi.getSalaryRecords(schoolId!, { campus_id: campusId!, limit: 1000 }),
        { revalidateOnFocus: false }
    )

    // Fetch all employees (staff, teachers, admins) for balances
    const { data: staffResponse } = useSWR(
        campusId ? ['staff-list-balances', campusId] : null,
        async () => {
            // Use 'employees' role to include teachers, staff, admin, etc.
            const result = await getAllStaff(1, 1000, undefined, 'employees', campusId!)
            return result
        },
        { revalidateOnFocus: false }
    )

    const isLoading = paymentsLoading || salariesLoading

    // Calculate balances per staff combining salary_records + manual payments
    const staffBalances = useMemo(() => {
        // Backend returns { success, data: { data: Staff[], total, ... } }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const staffList: Staff[] = Array.isArray((staffResponse as any)?.data?.data) ? (staffResponse as any).data.data : []
        const salaryRecords = salaryRecordsData?.data || []
        if (staffList.length === 0) return []

        const balanceMap = new Map<string, StaffBalance>()

        // Initialize all staff with zero balances
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

        // Aggregate salary records (auto-generated from Salary module)
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

        // Aggregate manual payments from accounting_payments
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

        // Calculate final balance for each staff
        balanceMap.forEach(sb => {
            // Balance = Total salary due - Paid salaries - Manual payments
            sb.balance = sb.total_salary_due - sb.total_salary_paid - sb.manual_payments
        })

        // Convert to array and sort by balance descending (highest owed first)
        return Array.from(balanceMap.values())
            .sort((a, b) => b.balance - a.balance)
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

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount)
    }

    const handlePrint = () => {
        window.print()
    }

    // Calculate totals
    const totalSalaryDue = useMemo(() => {
        return staffBalances.reduce((sum, sb) => sum + sb.total_salary_due, 0)
    }, [staffBalances])

    const totalSalaryPaid = useMemo(() => {
        return staffBalances.reduce((sum, sb) => sum + sb.total_salary_paid, 0)
    }, [staffBalances])

    const totalManualPayments = useMemo(() => {
        return staffBalances.reduce((sum, sb) => sum + sb.manual_payments, 0)
    }, [staffBalances])

    const totalBalance = useMemo(() => {
        return staffBalances.reduce((sum, sb) => sum + sb.balance, 0)
    }, [staffBalances])

    const staffWithSalaries = useMemo(() => {
        return staffBalances.filter(sb => sb.salary_count > 0).length
    }, [staffBalances])

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
                        <p className="text-muted-foreground text-center">Please select a campus to view staff balances.</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Staff Balances</h1>
                    <p className="text-muted-foreground">
                        View payment summary per staff member • {selectedCampus.name}
                    </p>
                </div>
                <Button onClick={handlePrint} variant="outline">
                    <IconPrinter className="h-4 w-4 mr-2" />
                    Print
                </Button>
            </div>

            {/* Date Filter */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-4 flex-wrap">
                        <span className="font-medium">Timeframe:</span>
                        <div className="flex items-center gap-2">
                            <Select value={startMonth} onValueChange={setStartMonth}>
                                <SelectTrigger className="w-28">
                                    <SelectValue placeholder="Month" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="N/A">N/A</SelectItem>
                                    {MONTHS.map(m => (
                                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={startDay} onValueChange={setStartDay}>
                                <SelectTrigger className="w-20">
                                    <SelectValue placeholder="Day" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="N/A">N/A</SelectItem>
                                    {getDaysInMonth(startMonth === 'N/A' ? '01' : startMonth, startYear === 'N/A' ? String(today.getFullYear()) : startYear).map(d => (
                                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={startYear} onValueChange={setStartYear}>
                                <SelectTrigger className="w-24">
                                    <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="N/A">N/A</SelectItem>
                                    {getYears().map(y => (
                                        <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <span>to</span>
                        <div className="flex items-center gap-2">
                            <Select value={endMonth} onValueChange={setEndMonth}>
                                <SelectTrigger className="w-28">
                                    <SelectValue placeholder="Month" />
                                </SelectTrigger>
                                <SelectContent>
                                    {MONTHS.map(m => (
                                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={endDay} onValueChange={setEndDay}>
                                <SelectTrigger className="w-20">
                                    <SelectValue placeholder="Day" />
                                </SelectTrigger>
                                <SelectContent>
                                    {getDaysInMonth(endMonth, endYear).map(d => (
                                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={endYear} onValueChange={setEndYear}>
                                <SelectTrigger className="w-24">
                                    <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {getYears().map(y => (
                                        <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleApplyFilters} variant="default" className="bg-[#3d8fb5] hover:bg-[#357ea0]">
                            GO
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Staff</CardDescription>
                        <CardTitle className="text-2xl">{staffBalances.length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Staff With Salaries</CardDescription>
                        <CardTitle className="text-2xl">{staffWithSalaries}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Salary Paid</CardDescription>
                        <CardTitle className="text-2xl text-green-600">{formatCurrency(totalSalaryPaid)}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Balance Owed</CardDescription>
                        <CardTitle className={`text-2xl ${totalBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(totalBalance)}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Staff Balances Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Staff Salary Balances</CardTitle>
                    <CardDescription>
                        Auto-generated salary records from the Salary module + manual payments
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : staffBalances.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No staff members found.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>STAFF NAME</TableHead>
                                    <TableHead>DESIGNATION</TableHead>
                                    <TableHead className="text-right">SALARY DUE</TableHead>
                                    <TableHead className="text-right">SALARY PAID</TableHead>
                                    <TableHead className="text-right">MANUAL PMT</TableHead>
                                    <TableHead className="text-right">BALANCE</TableHead>
                                    <TableHead>STATUS</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {staffBalances.map(sb => (
                                    <TableRow key={sb.staff_id}>
                                        <TableCell className="font-medium">{sb.staff_name}</TableCell>
                                        <TableCell>{sb.designation || '-'}</TableCell>
                                        <TableCell className="text-right">
                                            {sb.total_salary_due > 0 ? (
                                                <span>{formatCurrency(sb.total_salary_due)}</span>
                                            ) : (
                                                <span className="text-muted-foreground">$0.00</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {sb.total_salary_paid > 0 ? (
                                                <span className="text-green-600">{formatCurrency(sb.total_salary_paid)}</span>
                                            ) : (
                                                <span className="text-muted-foreground">$0.00</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {sb.manual_payments > 0 ? (
                                                <span className="text-blue-600">{formatCurrency(sb.manual_payments)}</span>
                                            ) : (
                                                <span className="text-muted-foreground">$0.00</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">
                                            {sb.balance > 0 ? (
                                                <span className="text-red-600">{formatCurrency(sb.balance)}</span>
                                            ) : sb.balance < 0 ? (
                                                <span className="text-green-600">{formatCurrency(sb.balance)}</span>
                                            ) : (
                                                <span className="text-muted-foreground">$0.00</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {sb.balance <= 0 ? (
                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                    Paid
                                                </Badge>
                                            ) : sb.total_salary_paid > 0 || sb.manual_payments > 0 ? (
                                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                                    Partial
                                                </Badge>
                                            ) : sb.salary_count > 0 ? (
                                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                                    Pending
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200">
                                                    No Salary
                                                </Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Totals Footer */}
            <Card>
                <CardContent className="pt-6">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span>Total Salary Generated:</span>
                            <span className="font-medium">{formatCurrency(totalSalaryDue)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span>Total Salary Paid:</span>
                            <span className="font-medium text-green-600">{formatCurrency(totalSalaryPaid)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span>Total Manual Payments:</span>
                            <span className="font-medium text-blue-600">{formatCurrency(totalManualPayments)}</span>
                        </div>
                        <div className="flex justify-between items-center text-lg font-semibold border-t pt-2">
                            <span>Total Balance Owed:</span>
                            <span className={totalBalance > 0 ? 'text-red-600' : 'text-green-600'}>
                                {formatCurrency(totalBalance)}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
