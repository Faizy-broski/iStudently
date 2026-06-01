'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { usePayrollSettings } from '@/hooks/useSalary'
import { updatePayrollSettings } from '@/lib/api/salary'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function SalarySettingsPage() {
    const t = useTranslations('admin.salary.settings')
    const tCommon = useTranslations('common')
    const { profile } = useAuth()
    const campusContext = useCampus()
    const schoolId = profile?.school_id || null

    const campusId = campusContext?.selectedCampus?.id
    const { data: settings, mutate } = usePayrollSettings(schoolId, campusId)

    const [graceLateCount, setGraceLateCount] = useState(3)
    const [lateThresholdMinutes, setLateThresholdMinutes] = useState(15)
    const [deductionType, setDeductionType] = useState<'percentage' | 'fixed' | 'per_minute'>('per_minute')
    const [deductionValue, setDeductionValue] = useState(1)
    const [absenceDeductionPercent, setAbsenceDeductionPercent] = useState(100)
    const [attendanceBonusEnabled, setAttendanceBonusEnabled] = useState(false)
    const [attendanceBonusAmount, setAttendanceBonusAmount] = useState(0)
    const [maxAdvancePercent, setMaxAdvancePercent] = useState(50)
    const [expectedCheckIn, setExpectedCheckIn] = useState('08:00')
    const [workingDaysPerMonth, setWorkingDaysPerMonth] = useState(22)

    // Monthly one-time adjustments
    const [monthlyBonusEnabled, setMonthlyBonusEnabled] = useState(false)
    const [monthlyBonusAmount, setMonthlyBonusAmount] = useState(0)
    const [monthlyBonusReason, setMonthlyBonusReason] = useState('')
    const [monthlyDeductionEnabled, setMonthlyDeductionEnabled] = useState(false)
    const [monthlyDeductionAmount, setMonthlyDeductionAmount] = useState(0)
    const [monthlyDeductionReason, setMonthlyDeductionReason] = useState('')

    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (settings) {
            setGraceLateCount(settings.grace_late_count)
            setLateThresholdMinutes(settings.late_threshold_minutes)
            setDeductionType(settings.deduction_type)
            setDeductionValue(settings.deduction_value)
            setAbsenceDeductionPercent(settings.absence_deduction_percent)
            setAttendanceBonusEnabled(settings.attendance_bonus_enabled)
            setAttendanceBonusAmount(settings.attendance_bonus_amount)
            setMaxAdvancePercent(settings.max_advance_percent)
            setExpectedCheckIn(settings.expected_check_in)
            setWorkingDaysPerMonth(settings.working_days_per_month)
            setMonthlyBonusEnabled(settings.monthly_bonus_enabled ?? false)
            setMonthlyBonusAmount(settings.monthly_bonus_amount ?? 0)
            setMonthlyBonusReason(settings.monthly_bonus_reason ?? '')
            setMonthlyDeductionEnabled(settings.monthly_deduction_enabled ?? false)
            setMonthlyDeductionAmount(settings.monthly_deduction_amount ?? 0)
            setMonthlyDeductionReason(settings.monthly_deduction_reason ?? '')
        }
    }, [settings])

    const handleSave = async () => {
        if (!schoolId) return
        setSaving(true)
        try {
            await updatePayrollSettings(schoolId, {
                grace_late_count: graceLateCount,
                late_threshold_minutes: lateThresholdMinutes,
                deduction_type: deductionType,
                deduction_value: deductionValue,
                absence_deduction_percent: absenceDeductionPercent,
                attendance_bonus_enabled: attendanceBonusEnabled,
                attendance_bonus_amount: attendanceBonusAmount,
                max_advance_percent: maxAdvancePercent,
                expected_check_in: expectedCheckIn,
                working_days_per_month: workingDaysPerMonth,
                monthly_bonus_enabled: monthlyBonusEnabled,
                monthly_bonus_amount: monthlyBonusAmount,
                monthly_bonus_reason: monthlyBonusReason,
                monthly_deduction_enabled: monthlyDeductionEnabled,
                monthly_deduction_amount: monthlyDeductionAmount,
                monthly_deduction_reason: monthlyDeductionReason
            }, campusId)
            mutate()
            toast.success(t('toast.saved'))
        } catch (error: any) {
            toast.error(error.message)
        }
        setSaving(false)
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/salary"><IconArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight dark:text-white">{t('title')}</h1>
                    {campusId && campusContext?.selectedCampus && (
                        <p className="text-sm text-muted-foreground">{t('campus', { name: campusContext.selectedCampus.name })}</p>
                    )}
                    <p className="text-muted-foreground">{t('subtitle')}</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('attendance_rules.title')}</CardTitle>
                        <CardDescription>{t('attendance_rules.description')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>{t('attendance_rules.grace_late_count')}</Label>
                                <Input type="number" value={graceLateCount} onChange={(e) => setGraceLateCount(parseInt(e.target.value))} />
                                <p className="text-xs text-muted-foreground mt-1">{t('attendance_rules.grace_late_count_hint')}</p>
                            </div>
                            <div>
                                <Label>{t('attendance_rules.late_threshold_minutes')}</Label>
                                <Input type="number" value={lateThresholdMinutes} onChange={(e) => setLateThresholdMinutes(parseInt(e.target.value))} />
                                <p className="text-xs text-muted-foreground mt-1">{t('attendance_rules.late_threshold_minutes_hint')}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>{t('attendance_rules.deduction_type')}</Label>
                                <Select value={deductionType} onValueChange={(v) => setDeductionType(v as any)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="per_minute">{t('attendance_rules.type_per_minute')}</SelectItem>
                                        <SelectItem value="percentage">{t('attendance_rules.type_percentage')}</SelectItem>
                                        <SelectItem value="fixed">{t('attendance_rules.type_fixed')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>{t('attendance_rules.deduction_value')}</Label>
                                <Input type="number" step="0.01" value={deductionValue} onChange={(e) => setDeductionValue(parseFloat(e.target.value))} />
                            </div>
                        </div>

                        <div>
                            <Label>{t('attendance_rules.absence_deduction_percent')}</Label>
                            <Input type="number" value={absenceDeductionPercent} onChange={(e) => setAbsenceDeductionPercent(parseFloat(e.target.value))} className="w-32" />
                            <p className="text-xs text-muted-foreground mt-1">{t('attendance_rules.absence_deduction_percent_hint')}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{t('attendance_bonus.title')}</CardTitle>
                        <CardDescription>{t('attendance_bonus.description')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label>{t('attendance_bonus.enabled')}</Label>
                            <Switch checked={attendanceBonusEnabled} onCheckedChange={setAttendanceBonusEnabled} />
                        </div>
                        {attendanceBonusEnabled && (
                            <div>
                                <Label>{t('attendance_bonus.amount')}</Label>
                                <Input type="number" step="0.01" value={attendanceBonusAmount} onChange={(e) => setAttendanceBonusAmount(parseFloat(e.target.value))} />
                                <p className="text-xs text-muted-foreground mt-1">{t('attendance_bonus.amount_hint')}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{t('monthly_bonus.title')}</CardTitle>
                        <CardDescription>{t('monthly_bonus.description')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label>{t('monthly_bonus.enabled')}</Label>
                            <Switch checked={monthlyBonusEnabled} onCheckedChange={setMonthlyBonusEnabled} />
                        </div>
                        {monthlyBonusEnabled && (
                            <>
                                <div>
                                    <Label>{t('monthly_bonus.amount')}</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={monthlyBonusAmount}
                                        onChange={(e) => setMonthlyBonusAmount(parseFloat(e.target.value) || 0)}
                                        className="w-40"
                                    />
                                </div>
                                <div>
                                    <Label>{t('monthly_bonus.reason')}</Label>
                                    <Textarea
                                        value={monthlyBonusReason}
                                        onChange={(e) => setMonthlyBonusReason(e.target.value)}
                                        placeholder={t('monthly_bonus.reason_placeholder')}
                                        className="h-20 resize-none"
                                    />
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{t('monthly_deduction.title')}</CardTitle>
                        <CardDescription>{t('monthly_deduction.description')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label>{t('monthly_deduction.enabled')}</Label>
                            <Switch checked={monthlyDeductionEnabled} onCheckedChange={setMonthlyDeductionEnabled} />
                        </div>
                        {monthlyDeductionEnabled && (
                            <>
                                <div>
                                    <Label>{t('monthly_deduction.amount')}</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={monthlyDeductionAmount}
                                        onChange={(e) => setMonthlyDeductionAmount(parseFloat(e.target.value) || 0)}
                                        className="w-40"
                                    />
                                </div>
                                <div>
                                    <Label>{t('monthly_deduction.reason')}</Label>
                                    <Textarea
                                        value={monthlyDeductionReason}
                                        onChange={(e) => setMonthlyDeductionReason(e.target.value)}
                                        placeholder={t('monthly_deduction.reason_placeholder')}
                                        className="h-20 resize-none"
                                    />
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{t('advance.title')}</CardTitle>
                        <CardDescription>{t('advance.description')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>{t('advance.max_percent')}</Label>
                            <Input type="number" value={maxAdvancePercent} onChange={(e) => setMaxAdvancePercent(parseFloat(e.target.value))} className="w-32" />
                            <p className="text-xs text-muted-foreground mt-1">{t('advance.max_percent_hint')}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{t('working_hours.title')}</CardTitle>
                        <CardDescription>{t('working_hours.description')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>{t('working_hours.expected_check_in')}</Label>
                                <Input type="time" value={expectedCheckIn} onChange={(e) => setExpectedCheckIn(e.target.value)} />
                            </div>
                            <div>
                                <Label>{t('working_hours.working_days_per_month')}</Label>
                                <Input type="number" value={workingDaysPerMonth} onChange={(e) => setWorkingDaysPerMonth(parseInt(e.target.value))} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Button onClick={handleSave} disabled={saving} size="lg">
                <IconDeviceFloppy className="mr-2 h-4 w-4" />
                {saving ? tCommon('saving') + '...' : t('save')}
            </Button>
        </div>
    )
}
