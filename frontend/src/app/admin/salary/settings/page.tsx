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
import { IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function SalarySettingsPage() {
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
                working_days_per_month: workingDaysPerMonth
            }, campusId)
            mutate()
            toast.success('Settings saved successfully')
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
                    <h1 className="text-3xl font-bold tracking-tight dark:text-white">Payroll Settings</h1>
                    <p className="text-muted-foreground">Configure salary deductions, bonuses, and advance rules</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Attendance Deduction Rules</CardTitle>
                        <CardDescription>Configure late arrival and absence deductions</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Grace Late Count</Label>
                                <Input type="number" value={graceLateCount} onChange={(e) => setGraceLateCount(parseInt(e.target.value))} />
                                <p className="text-xs text-muted-foreground mt-1">Free late arrivals before deduction</p>
                            </div>
                            <div>
                                <Label>Late Threshold (minutes)</Label>
                                <Input type="number" value={lateThresholdMinutes} onChange={(e) => setLateThresholdMinutes(parseInt(e.target.value))} />
                                <p className="text-xs text-muted-foreground mt-1">Minutes late before counting</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Deduction Type</Label>
                                <Select value={deductionType} onValueChange={(v) => setDeductionType(v as any)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="per_minute">Per Minute</SelectItem>
                                        <SelectItem value="percentage">Percentage of Daily</SelectItem>
                                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Deduction Value</Label>
                                <Input type="number" step="0.01" value={deductionValue} onChange={(e) => setDeductionValue(parseFloat(e.target.value))} />
                            </div>
                        </div>

                        <div>
                            <Label>Absence Deduction (%)</Label>
                            <Input type="number" value={absenceDeductionPercent} onChange={(e) => setAbsenceDeductionPercent(parseFloat(e.target.value))} className="w-32" />
                            <p className="text-xs text-muted-foreground mt-1">% of daily salary to deduct for absence</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Attendance Bonus</CardTitle>
                        <CardDescription>Reward perfect attendance</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label>Enable Attendance Bonus</Label>
                            <Switch checked={attendanceBonusEnabled} onCheckedChange={setAttendanceBonusEnabled} />
                        </div>
                        {attendanceBonusEnabled && (
                            <div>
                                <Label>Bonus Amount ($)</Label>
                                <Input type="number" step="0.01" value={attendanceBonusAmount} onChange={(e) => setAttendanceBonusAmount(parseFloat(e.target.value))} />
                                <p className="text-xs text-muted-foreground mt-1">Bonus for zero late arrivals/absences in a month</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Salary Advance</CardTitle>
                        <CardDescription>Configure advance request limits</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>Maximum Advance (%)</Label>
                            <Input type="number" value={maxAdvancePercent} onChange={(e) => setMaxAdvancePercent(parseFloat(e.target.value))} className="w-32" />
                            <p className="text-xs text-muted-foreground mt-1">% of base salary allowed as advance</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Working Hours</CardTitle>
                        <CardDescription>Define standard work schedule</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Expected Check-In</Label>
                                <Input type="time" value={expectedCheckIn} onChange={(e) => setExpectedCheckIn(e.target.value)} />
                            </div>
                            <div>
                                <Label>Working Days/Month</Label>
                                <Input type="number" value={workingDaysPerMonth} onChange={(e) => setWorkingDaysPerMonth(parseInt(e.target.value))} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Button onClick={handleSave} disabled={saving} size="lg">
                <IconDeviceFloppy className="mr-2 h-4 w-4" />
                {saving ? 'Saving...' : 'Save Settings'}
            </Button>
        </div>
    )
}
