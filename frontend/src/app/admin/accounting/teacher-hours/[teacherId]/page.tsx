'use client'

import { useState, useEffect, useMemo } from 'react'
import { useCampus } from '@/context/CampusContext'
import { useAcademic } from '@/context/AcademicContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { IconLoader, IconSearch, IconClock, IconCalendar } from '@tabler/icons-react'
import { toast } from 'sonner'
import useSWR from 'swr'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import * as accountingApi from '@/lib/api/accounting'
import type { TeacherHoursEntry } from '@/lib/api/accounting'
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

export default function TeacherHoursDetailPage() {
    const t = useTranslations('admin.accounting.teacher_hours_detail')
    const tCommon = useTranslations('common')
    const params = useParams()
    const teacherId = params.teacherId as string

    const { selectedCampus, loading: campusLoading } = useCampus() || {}
    const { currentAcademicYear } = useAcademic()
    const campusId = selectedCampus?.id
    const academicYearId = currentAcademicYear?.id
    const { formatCurrency } = useSchoolSettings()

    const today = new Date()
    const [startMonth, setStartMonth] = useState(String(today.getMonth() + 1).padStart(2, '0'))
    const [startDay, setStartDay] = useState('01')
    const [startYear, setStartYear] = useState(String(today.getFullYear()))
    const [endMonth, setEndMonth] = useState(String(today.getMonth() + 1).padStart(2, '0'))
    const [endDay, setEndDay] = useState(String(today.getDate()).padStart(2, '0'))
    const [endYear, setEndYear] = useState(String(today.getFullYear()))

    const [manualMode, setManualMode] = useState(false)
    const [deduceAbsences, setDeduceAbsences] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [rates, setRates] = useState<Record<string, number>>({})
    const [saving, setSaving] = useState(false)

    const startDate = `${startYear}-${startMonth}-${startDay}`
    const endDate = `${endYear}-${endMonth}-${endDay}`

    const { data: hoursResponse, isLoading, mutate } = useSWR(
        campusId && academicYearId && teacherId ? ['teacher-hours-detail', campusId, teacherId, startDate, endDate] : null,
        () => accountingApi.getTeacherHoursDetail(campusId!, teacherId, startDate, endDate, academicYearId!),
        { revalidateOnFocus: false }
    )

    const entries: TeacherHoursEntry[] = useMemo(() => hoursResponse?.data || [], [hoursResponse?.data])

    useEffect(() => {
        if (entries.length > 0) {
            const initialRates: Record<string, number> = {}
            entries.forEach(e => {
                initialRates[e.timetable_entry_id] = e.hourly_rate
            })
            setRates(initialRates)
        }
    }, [entries])

    const filteredEntries = useMemo(() => {
        if (!searchQuery) return entries
        const query = searchQuery.toLowerCase()
        return entries.filter(e =>
            e.subject_name.toLowerCase().includes(query) ||
            e.period_name.toLowerCase().includes(query)
        )
    }, [entries, searchQuery])

    const calculatedEntries = useMemo(() => {
        return filteredEntries.map(e => {
            const rate = rates[e.timetable_entry_id] ?? e.hourly_rate
            return {
                ...e,
                hourly_rate: rate,
                total_amount: Math.round(e.total_hours * rate * 100) / 100
            }
        })
    }, [filteredEntries, rates])

    const totalHours = useMemo(() => calculatedEntries.reduce((sum, e) => sum + e.total_hours, 0), [calculatedEntries])
    const totalAmount = useMemo(() => calculatedEntries.reduce((sum, e) => sum + e.total_amount, 0), [calculatedEntries])

    const handleRateChange = (entryId: string, value: string) => {
        const numValue = parseFloat(value) || 0
        setRates(prev => ({ ...prev, [entryId]: numValue }))
    }

    const handleSave = async () => {
        if (!campusId) return
        setSaving(true)
        try {
            const ratesArray = Object.entries(rates).map(([timetable_entry_id, hourly_rate]) => ({
                timetable_entry_id,
                hourly_rate
            }))
            await accountingApi.updateTeacherHourlyRates(campusId, teacherId, ratesArray)
            toast.success(t('toast.saved'))
            mutate()
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : t('toast.save_failed'))
        } finally {
            setSaving(false)
        }
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
                        <p className="text-muted-foreground text-center">{t('select_campus')}</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <IconClock className="h-8 w-8 text-[#3d8fb5]" />
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
                    </div>
                </div>
                <Link href="/admin/accounting/teacher-hours" className="text-[#3d8fb5] hover:underline text-sm">
                    {t('all_teachers')}
                </Link>
            </div>

            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="manualMode"
                        checked={manualMode}
                        onCheckedChange={(checked) => setManualMode(checked === true)}
                    />
                    <label htmlFor="manualMode" className="text-sm cursor-pointer">
                        {t('manual_mode')}
                    </label>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{t('period')}</span>
                    <div className="flex items-center gap-1">
                        <Select value={startMonth} onValueChange={setStartMonth}>
                            <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {MONTHS.map(m => (
                                    <SelectItem key={m.value} value={m.value}>{tCommon(`months.${m.monthKey}`)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={startDay} onValueChange={setStartDay}>
                            <SelectTrigger className="w-16 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {getDaysInMonth(startMonth, startYear).map(d => (
                                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={startYear} onValueChange={setStartYear}>
                            <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {getYears().map(y => (
                                    <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <IconCalendar className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span>{tCommon('to')}</span>
                    <div className="flex items-center gap-1">
                        <Select value={endMonth} onValueChange={setEndMonth}>
                            <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {MONTHS.map(m => (
                                    <SelectItem key={m.value} value={m.value}>{tCommon(`months.${m.monthKey}`)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={endDay} onValueChange={setEndDay}>
                            <SelectTrigger className="w-16 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {getDaysInMonth(endMonth, endYear).map(d => (
                                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={endYear} onValueChange={setEndYear}>
                            <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {getYears().map(y => (
                                    <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <IconCalendar className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Button size="sm" onClick={() => mutate()} className="bg-[#3d8fb5] hover:bg-[#357ea0]">
                        {tCommon('view')}
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    <Checkbox
                        id="deduceAbsences"
                        checked={deduceAbsences}
                        onCheckedChange={(checked) => setDeduceAbsences(checked === true)}
                    />
                    <label htmlFor="deduceAbsences" className="text-sm cursor-pointer">
                        {t('deduce_absences')}
                    </label>
                    <span className="text-xs text-muted-foreground">(ⓘ)</span>
                </div>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            {t('found_count', { count: calculatedEntries.length })}
                        </p>
                        <div className="relative">
                            <Input
                                placeholder={tCommon('search')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-64 pr-8"
                            />
                            <IconSearch className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="pt-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : calculatedEntries.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">{t('empty')}</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-[#3d8fb5]">{t('col_subject')}</TableHead>
                                    <TableHead className="text-[#3d8fb5]">{t('col_period')}</TableHead>
                                    <TableHead className="text-[#3d8fb5] text-right">{t('col_hours')}</TableHead>
                                    <TableHead className="text-[#3d8fb5] text-right">{t('col_rate')}</TableHead>
                                    <TableHead className="text-[#3d8fb5] text-right">{t('col_total')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {calculatedEntries.map(entry => {
                                    const dayIndex = entry.day_of_week === 7 ? 0 : entry.day_of_week
                                    const dayName = tCommon(`days.${dayIndex}`)

                                    return (
                                        <TableRow key={entry.timetable_entry_id}>
                                            <TableCell>{entry.subject_name}</TableCell>
                                            <TableCell>{dayName} - {entry.period_name}</TableCell>
                                            <TableCell className="text-right">{entry.total_hours}</TableCell>
                                            <TableCell className="text-right">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={rates[entry.timetable_entry_id] ?? entry.hourly_rate}
                                                    onChange={(e) => handleRateChange(entry.timetable_entry_id, e.target.value)}
                                                    className="w-20 h-7 text-right text-[#3d8fb5] border border-gray-300 rounded px-2 text-sm inline-block"
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {formatCurrency(entry.total_amount)}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                                <TableRow className="font-semibold bg-muted/50">
                                    <TableCell colSpan={2}>{tCommon('total')}</TableCell>
                                    <TableCell className="text-right">{totalHours}</TableCell>
                                    <TableCell></TableCell>
                                    <TableCell className="text-right">{formatCurrency(totalAmount)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {calculatedEntries.length > 0 && (
                <div className="flex justify-center">
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-[#3d8fb5] hover:bg-[#357ea0] px-8"
                    >
                        {saving ? t('saving') : tCommon('save')}
                    </Button>
                </div>
            )}
        </div>
    )
}
