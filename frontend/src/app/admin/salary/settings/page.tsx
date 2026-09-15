'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { usePayrollSettings } from '@/hooks/useSalary'
import { useSchoolSettings } from '@/hooks/useSchoolSettings'
import {
    updatePayrollSettings,
    getPolicyGroups,
    createPolicyGroup,
    updatePolicyGroup,
    deletePolicyGroup,
    getTeachersWithPolicyInfo,
    assignTeachersToPolicy,
    removeTeacherFromPolicy,
    type SalaryPolicyGroup,
    type StaffWithPolicy,
} from '@/lib/api/salary'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
    IconArrowLeft,
    IconDeviceFloppy,
    IconPlus,
    IconEdit,
    IconTrash,
    IconUsers,
    IconX,
    IconSearch,
    IconChevronDown,
    IconChevronUp,
    IconSettings,
} from '@tabler/icons-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

// ─── Settings fields component (reused for default settings + policy modals) ──

interface SettingsFields {
    grace_late_count: number
    late_threshold_minutes: number
    deduction_type: 'percentage' | 'fixed' | 'per_minute'
    deduction_value: number
    absence_deduction_percent: number
    attendance_bonus_enabled: boolean
    attendance_bonus_amount: number
    monthly_bonus_enabled: boolean
    monthly_bonus_amount: number
    monthly_bonus_reason: string
    monthly_deduction_enabled: boolean
    monthly_deduction_amount: number
    monthly_deduction_reason: string
    max_advance_percent: number
    expected_check_in: string
    working_days_per_month: number
}

const defaultFields = (): SettingsFields => ({
    grace_late_count: 3,
    late_threshold_minutes: 15,
    deduction_type: 'per_minute',
    deduction_value: 1,
    absence_deduction_percent: 100,
    attendance_bonus_enabled: false,
    attendance_bonus_amount: 0,
    monthly_bonus_enabled: false,
    monthly_bonus_amount: 0,
    monthly_bonus_reason: '',
    monthly_deduction_enabled: false,
    monthly_deduction_amount: 0,
    monthly_deduction_reason: '',
    max_advance_percent: 50,
    expected_check_in: '08:00',
    working_days_per_month: 22,
})

function SettingsForm({ values, onChange, currencySymbol = '$' }: {
    values: SettingsFields
    onChange: (patch: Partial<SettingsFields>) => void
    currencySymbol?: string
}) {
    const t = useTranslations('salary.settings')
    return (
        <div className="grid gap-6 md:grid-cols-2">
            {/* Attendance Deduction Rules */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t('attendanceRulesTitle')}</CardTitle>
                    <CardDescription className="text-xs">{t('attendanceRulesSubtitle')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs">{t('graceLateCount')}</Label>
                            <Input type="number" value={values.grace_late_count}
                                onChange={e => onChange({ grace_late_count: parseInt(e.target.value) || 0 })} />
                            <p className="text-xs text-muted-foreground mt-1">{t('graceLateCountHint')}</p>
                        </div>
                        <div>
                            <Label className="text-xs">{t('lateThreshold')}</Label>
                            <Input type="number" value={values.late_threshold_minutes}
                                onChange={e => onChange({ late_threshold_minutes: parseInt(e.target.value) || 0 })} />
                            <p className="text-xs text-muted-foreground mt-1">{t('lateThresholdHint')}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs">{t('deductionType')}</Label>
                            <Select value={values.deduction_type}
                                onValueChange={v => onChange({ deduction_type: v as any })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="per_minute">{t('perMinute')}</SelectItem>
                                    <SelectItem value="percentage">{t('percentage')}</SelectItem>
                                    <SelectItem value="fixed">{t('fixedAmount')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs">{t('deductionValue')}</Label>
                            <Input type="number" step="0.01" value={values.deduction_value}
                                onChange={e => onChange({ deduction_value: parseFloat(e.target.value) || 0 })} />
                        </div>
                    </div>
                    <div>
                        <Label className="text-xs">{t('absenceDeductionPercent')}</Label>
                        <Input type="number" value={values.absence_deduction_percent} className="w-28"
                            onChange={e => onChange({ absence_deduction_percent: parseFloat(e.target.value) || 0 })} />
                        <p className="text-xs text-muted-foreground mt-1">{t('absenceDeductionHint')}</p>
                    </div>
                </CardContent>
            </Card>

            {/* Attendance Bonus */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t('attendanceBonusTitle')}</CardTitle>
                    <CardDescription className="text-xs">{t('attendanceBonusSubtitle')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">{t('enableAttendanceBonus')}</Label>
                        <Switch checked={values.attendance_bonus_enabled}
                            onCheckedChange={v => onChange({ attendance_bonus_enabled: v })} />
                    </div>
                    {values.attendance_bonus_enabled && (
                        <div>
                            <Label className="text-xs">{t('bonusAmount', { symbol: currencySymbol })}</Label>
                            <Input type="number" step="0.01" value={values.attendance_bonus_amount}
                                onChange={e => onChange({ attendance_bonus_amount: parseFloat(e.target.value) || 0 })} />
                            <p className="text-xs text-muted-foreground mt-1">{t('attendanceBonusHint')}</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Monthly Bonus */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t('monthlyBonusTitle')}</CardTitle>
                    <CardDescription className="text-xs">{t('monthlyBonusSubtitle')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">{t('enableMonthlyBonus')}</Label>
                        <Switch checked={values.monthly_bonus_enabled}
                            onCheckedChange={v => onChange({ monthly_bonus_enabled: v })} />
                    </div>
                    {values.monthly_bonus_enabled && (
                        <>
                            <div>
                                <Label className="text-xs">{t('amount', { symbol: currencySymbol })}</Label>
                                <Input type="number" step="0.01" min="0" className="w-36"
                                    value={values.monthly_bonus_amount}
                                    onChange={e => onChange({ monthly_bonus_amount: parseFloat(e.target.value) || 0 })} />
                            </div>
                            <div>
                                <Label className="text-xs">{t('reason')}</Label>
                                <Textarea value={values.monthly_bonus_reason} className="h-16 resize-none"
                                    placeholder={t('monthlyBonusReasonPlaceholder')}
                                    onChange={e => onChange({ monthly_bonus_reason: e.target.value })} />
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Monthly Deduction */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t('monthlyDeductionTitle')}</CardTitle>
                    <CardDescription className="text-xs">{t('monthlyDeductionSubtitle')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">{t('enableMonthlyDeduction')}</Label>
                        <Switch checked={values.monthly_deduction_enabled}
                            onCheckedChange={v => onChange({ monthly_deduction_enabled: v })} />
                    </div>
                    {values.monthly_deduction_enabled && (
                        <>
                            <div>
                                <Label className="text-xs">{t('amount', { symbol: currencySymbol })}</Label>
                                <Input type="number" step="0.01" min="0" className="w-36"
                                    value={values.monthly_deduction_amount}
                                    onChange={e => onChange({ monthly_deduction_amount: parseFloat(e.target.value) || 0 })} />
                            </div>
                            <div>
                                <Label className="text-xs">{t('reason')}</Label>
                                <Textarea value={values.monthly_deduction_reason} className="h-16 resize-none"
                                    placeholder={t('monthlyDeductionReasonPlaceholder')}
                                    onChange={e => onChange({ monthly_deduction_reason: e.target.value })} />
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Salary Advance */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t('salaryAdvanceTitle')}</CardTitle>
                    <CardDescription className="text-xs">{t('salaryAdvanceSubtitle')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div>
                        <Label className="text-xs">{t('maxAdvance')}</Label>
                        <Input type="number" value={values.max_advance_percent} className="w-28"
                            onChange={e => onChange({ max_advance_percent: parseFloat(e.target.value) || 0 })} />
                        <p className="text-xs text-muted-foreground mt-1">{t('maxAdvanceHint')}</p>
                    </div>
                </CardContent>
            </Card>

            {/* Working Hours */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t('workingHoursTitle')}</CardTitle>
                    <CardDescription className="text-xs">{t('workingHoursSubtitle')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs">{t('expectedCheckIn')}</Label>
                            <Input type="time" value={values.expected_check_in}
                                onChange={e => onChange({ expected_check_in: e.target.value })} />
                        </div>
                        <div>
                            <Label className="text-xs">{t('workingDaysPerMonth')}</Label>
                            <Input type="number" value={values.working_days_per_month}
                                onChange={e => onChange({ working_days_per_month: parseInt(e.target.value) || 0 })} />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

// ─── Policy Group Settings Dialog ─────────────────────────────────────────────

function PolicyGroupDialog({
    open,
    onClose,
    onSave,
    initial,
    currencySymbol = '$',
}: {
    open: boolean
    onClose: () => void
    onSave: (name: string, description: string, fields: SettingsFields) => Promise<void>
    initial?: SalaryPolicyGroup | null
    currencySymbol?: string
}) {
    const t = useTranslations('salary.settings')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [fields, setFields] = useState<SettingsFields>(defaultFields())
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (open) {
            if (initial) {
                setName(initial.name)
                setDescription(initial.description || '')
                setFields({
                    grace_late_count: initial.grace_late_count,
                    late_threshold_minutes: initial.late_threshold_minutes,
                    deduction_type: initial.deduction_type,
                    deduction_value: initial.deduction_value,
                    absence_deduction_percent: initial.absence_deduction_percent,
                    attendance_bonus_enabled: initial.attendance_bonus_enabled,
                    attendance_bonus_amount: initial.attendance_bonus_amount,
                    monthly_bonus_enabled: initial.monthly_bonus_enabled,
                    monthly_bonus_amount: initial.monthly_bonus_amount,
                    monthly_bonus_reason: initial.monthly_bonus_reason,
                    monthly_deduction_enabled: initial.monthly_deduction_enabled,
                    monthly_deduction_amount: initial.monthly_deduction_amount,
                    monthly_deduction_reason: initial.monthly_deduction_reason,
                    max_advance_percent: initial.max_advance_percent,
                    expected_check_in: initial.expected_check_in,
                    working_days_per_month: initial.working_days_per_month,
                })
            } else {
                setName('')
                setDescription('')
                setFields(defaultFields())
            }
        }
    }, [open, initial])

    const handleSave = async () => {
        if (!name.trim()) { toast.error(t('policyNameRequired')); return }
        setSaving(true)
        try {
            await onSave(name.trim(), description.trim(), fields)
            onClose()
        } catch (e: any) {
            toast.error(e.message)
        }
        setSaving(false)
    }

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{initial ? t('editPolicyGroup') : t('newPolicyGroup')}</DialogTitle>
                    <DialogDescription>
                        {initial
                            ? t('updatePolicyDesc')
                            : t('createPolicyDesc')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>{t('policyName')} <span className="text-destructive">*</span></Label>
                            <Input value={name} onChange={e => setName(e.target.value)}
                                placeholder={t('policyNamePlaceholder')} />
                        </div>
                        <div>
                            <Label>{t('description')}</Label>
                            <Input value={description} onChange={e => setDescription(e.target.value)}
                                placeholder={t('descriptionPlaceholder')} />
                        </div>
                    </div>
                    <Separator />
                    <SettingsForm values={fields} onChange={patch => setFields(prev => ({ ...prev, ...patch }))} currencySymbol={currencySymbol} />
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={saving}>{t('cancel')}</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        <IconDeviceFloppy className="mr-2 h-4 w-4" />
                        {saving ? t('saving') : t('savePolicy')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ─── Teacher Assignment Dialog ─────────────────────────────────────────────────

function TeacherAssignmentDialog({
    open,
    onClose,
    policyGroup,
    allTeachers,
    onAssign,
    onRemove,
}: {
    open: boolean
    onClose: () => void
    policyGroup: SalaryPolicyGroup
    allTeachers: StaffWithPolicy[]
    onAssign: (staffIds: string[]) => Promise<void>
    onRemove: (staffId: string) => Promise<void>
}) {
    const t = useTranslations('salary.settings')
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [assigning, setAssigning] = useState(false)
    const [removingId, setRemovingId] = useState<string | null>(null)

    const assignedHere = allTeachers.filter(t => t.assigned_policy?.policy_group_id === policyGroup.id)
    const available = allTeachers.filter(t => !t.assigned_policy)
    const assignedElsewhere = allTeachers.filter(
        t => t.assigned_policy && t.assigned_policy.policy_group_id !== policyGroup.id
    )

    const filtered = [...available, ...assignedElsewhere].filter(t => {
        const q = search.toLowerCase()
        const name = `${t.profile.first_name} ${t.profile.last_name}`.toLowerCase()
        return !q || name.includes(q) || t.employee_number?.toLowerCase().includes(q)
    })

    const toggle = (id: string) => {
        const s = new Set(selected)
        s.has(id) ? s.delete(id) : s.add(id)
        setSelected(s)
    }

    const handleAssign = async () => {
        if (!selected.size) return
        setAssigning(true)
        try {
            await onAssign(Array.from(selected))
            setSelected(new Set())
            toast.success(t('teachersAssigned', { count: selected.size }))
        } catch (e: any) {
            toast.error(e.message)
        }
        setAssigning(false)
    }

    const handleRemove = async (staffId: string) => {
        setRemovingId(staffId)
        try {
            await onRemove(staffId)
            toast.success(t('teacherRemoved'))
        } catch (e: any) {
            toast.error(e.message)
        }
        setRemovingId(null)
    }

    const initials = (t: StaffWithPolicy) =>
        `${t.profile.first_name?.[0] || ''}${t.profile.last_name?.[0] || ''}`.toUpperCase()

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <IconUsers className="h-5 w-5" />
                        {t('manageTeachersTitle', { name: policyGroup.name })}
                    </DialogTitle>
                    <DialogDescription>
                        {t('manageTeachersDesc')}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 overflow-hidden flex-1 min-h-0">
                    {/* Currently assigned */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold">
                                {t('assignedToPolicy')}
                                <Badge variant="secondary" className="ml-2">{assignedHere.length}</Badge>
                            </p>
                        </div>
                        {assignedHere.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2 border rounded-lg text-center">
                                {t('noTeachersAssigned')}
                            </p>
                        ) : (
                            <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                                {assignedHere.map(t => (
                                    <div key={t.id} className="flex items-center justify-between px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-7 w-7">
                                                <AvatarImage src={t.profile.profile_photo_url} />
                                                <AvatarFallback className="text-xs">{initials(t)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="text-sm font-medium leading-none">
                                                    {t.profile.first_name} {t.profile.last_name}
                                                </p>
                                                <p className="text-xs text-muted-foreground">{t.employee_number}</p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                                            disabled={removingId === t.id}
                                            onClick={() => handleRemove(t.id)}
                                        >
                                            <IconX className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* Available teachers */}
                    <div className="flex flex-col gap-2 flex-1 min-h-0">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">
                                {t('availableTeachers')}
                                <Badge variant="outline" className="ml-2">{t('teachersCount', { count: available.length })} {t('unassigned')}</Badge>
                            </p>
                            {selected.size > 0 && (
                                <Button size="sm" onClick={handleAssign} disabled={assigning}>
                                    <IconPlus className="h-3.5 w-3.5 mr-1" />
                                    {assigning ? t('assigning') : t('addSelected', { count: selected.size })}
                                </Button>
                            )}
                        </div>

                        <div className="relative">
                            <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                className="pl-8 h-8 text-sm"
                                placeholder={t('searchTeachersPlaceholder')}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>

                        <div className="border rounded-lg divide-y overflow-y-auto flex-1 min-h-0">
                            {filtered.length === 0 && (
                                <p className="text-xs text-muted-foreground py-4 text-center">{t('noTeachersFound')}</p>
                            )}
                            {filtered.map(t => {
                                const inOther = !!t.assigned_policy
                                return (
                                    <div key={t.id}
                                        className={`flex items-center gap-3 px-3 py-2 ${inOther ? 'opacity-50' : 'cursor-pointer hover:bg-muted/40'}`}
                                        onClick={() => !inOther && toggle(t.id)}
                                    >
                                        <Checkbox
                                            checked={selected.has(t.id)}
                                            disabled={inOther}
                                            onCheckedChange={() => !inOther && toggle(t.id)}
                                        />
                                        <Avatar className="h-7 w-7">
                                            <AvatarImage src={t.profile.profile_photo_url} />
                                            <AvatarFallback className="text-xs">{initials(t)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium leading-none truncate">
                                                {t.profile.first_name} {t.profile.last_name}
                                            </p>
                                            <p className="text-xs text-muted-foreground">{t.employee_number}</p>
                                        </div>
                                        {inOther && (
                                            <Badge variant="secondary" className="text-xs shrink-0">
                                                {t.assigned_policy!.policy_name}
                                            </Badge>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// ─── Policy Group Card ─────────────────────────────────────────────────────────

function PolicyGroupCard({
    group,
    teacherCount,
    currencySymbol = '$',
    onEdit,
    onManageTeachers,
    onDelete,
}: {
    group: SalaryPolicyGroup
    teacherCount: number
    currencySymbol?: string
    onEdit: () => void
    onManageTeachers: () => void
    onDelete: () => void
}) {
    const t = useTranslations('salary.settings')
    return (
        <Card className="group relative">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{group.name}</CardTitle>
                        {group.description && (
                            <CardDescription className="text-xs mt-0.5 line-clamp-1">{group.description}</CardDescription>
                        )}
                    </div>
                    <Badge variant="secondary" className="shrink-0 flex items-center gap-1">
                        <IconUsers className="h-3 w-3" />
                        {teacherCount}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Key settings summary */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{t('checkIn')} <span className="text-foreground font-medium">{group.expected_check_in}</span></span>
                    <span>{t('workDays')} <span className="text-foreground font-medium">{group.working_days_per_month}/mo</span></span>
                    <span>{t('lateDeduction')} <span className="text-foreground font-medium capitalize">{group.deduction_type.replace('_', ' ')}</span></span>
                    <span>{t('absence')} <span className="text-foreground font-medium">{group.absence_deduction_percent}%</span></span>
                    {group.attendance_bonus_enabled && (
                        <span className="col-span-2 text-green-600 dark:text-green-400">
                            {t('attendanceBonusLine', { symbol: currencySymbol, amount: group.attendance_bonus_amount })}
                        </span>
                    )}
                    {group.monthly_bonus_enabled && (
                        <span className="col-span-2 text-green-600 dark:text-green-400">
                            {t('monthlyBonusLine', { symbol: currencySymbol, amount: group.monthly_bonus_amount })}
                        </span>
                    )}
                    {group.monthly_deduction_enabled && (
                        <span className="col-span-2 text-orange-600 dark:text-orange-400">
                            {t('monthlyDeductionLine', { symbol: currencySymbol, amount: group.monthly_deduction_amount })}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={onManageTeachers}>
                        <IconUsers className="h-3.5 w-3.5 mr-1" />
                        {t('manageTeachersBtn')}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onEdit}>
                        <IconEdit className="h-3.5 w-3.5 mr-1" />
                        {t('edit')}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={onDelete}>
                        <IconTrash className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SalarySettingsPage() {
    const t = useTranslations('salary.settings')
    const locale = useLocale()
    const isAr = locale === 'ar'
    const { profile } = useAuth()
    const campusContext = useCampus()
    const schoolId = profile?.school_id || null
    const campusId = campusContext?.selectedCampus?.id
    const { currencySymbol } = useSchoolSettings()

    // Default settings
    const { data: settings, mutate: mutateSettings } = usePayrollSettings(schoolId, campusId)
    const [defaultFields, setDefaultFields] = useState<SettingsFields>({
        grace_late_count: 3, late_threshold_minutes: 15, deduction_type: 'per_minute',
        deduction_value: 1, absence_deduction_percent: 100, attendance_bonus_enabled: false,
        attendance_bonus_amount: 0, monthly_bonus_enabled: false, monthly_bonus_amount: 0,
        monthly_bonus_reason: '', monthly_deduction_enabled: false, monthly_deduction_amount: 0,
        monthly_deduction_reason: '', max_advance_percent: 50, expected_check_in: '08:00',
        working_days_per_month: 22,
    })
    const [defaultExpanded, setDefaultExpanded] = useState(false)
    const [savingDefault, setSavingDefault] = useState(false)

    // Policy groups
    const [policyGroups, setPolicyGroups] = useState<SalaryPolicyGroup[]>([])
    const [allTeachers, setAllTeachers] = useState<StaffWithPolicy[]>([])
    const [loadingPolicies, setLoadingPolicies] = useState(true)

    // Dialogs
    const [policyDialogOpen, setPolicyDialogOpen] = useState(false)
    const [editingPolicy, setEditingPolicy] = useState<SalaryPolicyGroup | null>(null)
    const [teacherDialogPolicy, setTeacherDialogPolicy] = useState<SalaryPolicyGroup | null>(null)
    const [deletingPolicy, setDeletingPolicy] = useState<SalaryPolicyGroup | null>(null)
    const [deletingLoading, setDeletingLoading] = useState(false)

    // Sync default settings from API
    useEffect(() => {
        if (settings) {
            setDefaultFields({
                grace_late_count: settings.grace_late_count,
                late_threshold_minutes: settings.late_threshold_minutes,
                deduction_type: settings.deduction_type,
                deduction_value: settings.deduction_value,
                absence_deduction_percent: settings.absence_deduction_percent,
                attendance_bonus_enabled: settings.attendance_bonus_enabled,
                attendance_bonus_amount: settings.attendance_bonus_amount,
                monthly_bonus_enabled: settings.monthly_bonus_enabled ?? false,
                monthly_bonus_amount: settings.monthly_bonus_amount ?? 0,
                monthly_bonus_reason: settings.monthly_bonus_reason ?? '',
                monthly_deduction_enabled: settings.monthly_deduction_enabled ?? false,
                monthly_deduction_amount: settings.monthly_deduction_amount ?? 0,
                monthly_deduction_reason: settings.monthly_deduction_reason ?? '',
                max_advance_percent: settings.max_advance_percent,
                expected_check_in: settings.expected_check_in,
                working_days_per_month: settings.working_days_per_month,
            })
        }
    }, [settings])

    const loadData = useCallback(async () => {
        if (!schoolId) return
        setLoadingPolicies(true)
        try {
            const [groups, teachers] = await Promise.all([
                getPolicyGroups(schoolId, campusId),
                getTeachersWithPolicyInfo(schoolId, campusId),
            ])
            setPolicyGroups(groups)
            setAllTeachers(teachers)
        } catch (e: any) {
            toast.error(e.message)
        }
        setLoadingPolicies(false)
    }, [schoolId, campusId])

    useEffect(() => { loadData() }, [loadData])

    const handleSaveDefault = async () => {
        if (!schoolId) return
        setSavingDefault(true)
        try {
            await updatePayrollSettings(schoolId, defaultFields as any, campusId)
            mutateSettings()
            toast.success(t('defaultSettingsSaved'))
        } catch (e: any) {
            toast.error(e.message)
        }
        setSavingDefault(false)
    }

    const handleSavePolicy = async (name: string, description: string, fields: SettingsFields) => {
        if (!schoolId) return
        if (editingPolicy) {
            await updatePolicyGroup(editingPolicy.id, schoolId, { name, description, ...fields, campus_id: campusId ?? null })
            toast.success(t('policyUpdated'))
        } else {
            await createPolicyGroup(schoolId, { name, description, ...fields, campus_id: campusId ?? null } as any)
            toast.success(t('policyCreated'))
        }
        await loadData()
        setEditingPolicy(null)
    }

    const handleDeletePolicy = async () => {
        if (!deletingPolicy || !schoolId) return
        setDeletingLoading(true)
        try {
            await deletePolicyGroup(deletingPolicy.id, schoolId)
            toast.success(t('policyDeleted'))
            await loadData()
        } catch (e: any) {
            toast.error(e.message)
        }
        setDeletingLoading(false)
        setDeletingPolicy(null)
    }

    const handleAssign = async (staffIds: string[]) => {
        if (!teacherDialogPolicy || !schoolId) return
        await assignTeachersToPolicy(teacherDialogPolicy.id, schoolId, staffIds)
        await loadData()
    }

    const handleRemove = async (staffId: string) => {
        if (!teacherDialogPolicy) return
        await removeTeacherFromPolicy(teacherDialogPolicy.id, staffId)
        await loadData()
    }

    const teacherCountFor = (groupId: string) =>
        allTeachers.filter(t => t.assigned_policy?.policy_group_id === groupId).length

    const unassignedCount = allTeachers.filter(t => !t.assigned_policy).length

    return (
        <div className="container mx-auto py-6 space-y-8" dir={isAr ? 'rtl' : 'ltr'}>
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/salary"><IconArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight dark:text-white">{t('pageTitle')}</h1>
                    {campusId && campusContext?.selectedCampus && (
                        <p className="text-sm text-muted-foreground">{t('campusLabel', { name: campusContext.selectedCampus.name })}</p>
                    )}
                    <p className="text-muted-foreground text-sm">{t('pageSubtitle')}</p>
                </div>
            </div>

            {/* ── Default / Global Settings ── */}
            <div className="border rounded-xl">
                <button
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors rounded-xl"
                    onClick={() => setDefaultExpanded(v => !v)}
                >
                    <div className="flex items-center gap-3">
                        <IconSettings className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="font-semibold text-sm">{t('defaultSettings')}</p>
                            <p className="text-xs text-muted-foreground">
                                {t('appliedToAll')}
                                {unassignedCount > 0 && (
                                    <Badge variant="outline" className="ml-2">{t('teachersCount', { count: unassignedCount })}</Badge>
                                )}
                            </p>
                        </div>
                    </div>
                    {defaultExpanded
                        ? <IconChevronUp className="h-4 w-4 text-muted-foreground" />
                        : <IconChevronDown className="h-4 w-4 text-muted-foreground" />
                    }
                </button>

                {defaultExpanded && (
                    <div className="px-5 pb-5 space-y-5 border-t">
                        <div className="pt-5">
                            <SettingsForm
                                values={defaultFields}
                                onChange={patch => setDefaultFields(prev => ({ ...prev, ...patch }))}
                                currencySymbol={currencySymbol}
                            />
                        </div>
                        <Button onClick={handleSaveDefault} disabled={savingDefault}>
                            <IconDeviceFloppy className="mr-2 h-4 w-4" />
                            {savingDefault ? t('saving') : t('saveDefaultSettings')}
                        </Button>
                    </div>
                )}
            </div>

            {/* ── Policy Groups ── */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold">{t('policyGroups')}</h2>
                        <p className="text-sm text-muted-foreground">
                            {t('policyGroupsDesc')}
                        </p>
                    </div>
                    <Button onClick={() => { setEditingPolicy(null); setPolicyDialogOpen(true) }}>
                        <IconPlus className="mr-2 h-4 w-4" />
                        {t('newPolicy')}
                    </Button>
                </div>

                {loadingPolicies ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {[1, 2].map(i => (
                            <Card key={i} className="animate-pulse">
                                <CardHeader><div className="h-4 bg-muted rounded w-1/2" /></CardHeader>
                                <CardContent><div className="h-16 bg-muted rounded" /></CardContent>
                            </Card>
                        ))}
                    </div>
                ) : policyGroups.length === 0 ? (
                    <div className="border-2 border-dashed rounded-xl p-10 text-center text-muted-foreground">
                        <IconUsers className="h-8 w-8 mx-auto mb-3 opacity-40" />
                        <p className="font-medium">{t('noPolicyGroupsYet')}</p>
                        <p className="text-sm mt-1">
                            {t('noPolicyGroupsDesc')}
                        </p>
                        <Button variant="outline" className="mt-4"
                            onClick={() => { setEditingPolicy(null); setPolicyDialogOpen(true) }}>
                            <IconPlus className="mr-2 h-4 w-4" />
                            {t('createFirstPolicy')}
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {policyGroups.map(group => (
                            <PolicyGroupCard
                                key={group.id}
                                group={group}
                                teacherCount={teacherCountFor(group.id)}
                                currencySymbol={currencySymbol}
                                onEdit={() => { setEditingPolicy(group); setPolicyDialogOpen(true) }}
                                onManageTeachers={() => setTeacherDialogPolicy(group)}
                                onDelete={() => setDeletingPolicy(group)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Dialogs ── */}
            <PolicyGroupDialog
                open={policyDialogOpen}
                onClose={() => { setPolicyDialogOpen(false); setEditingPolicy(null) }}
                onSave={handleSavePolicy}
                initial={editingPolicy}
                currencySymbol={currencySymbol}
            />

            {teacherDialogPolicy && (
                <TeacherAssignmentDialog
                    open={!!teacherDialogPolicy}
                    onClose={() => setTeacherDialogPolicy(null)}
                    policyGroup={teacherDialogPolicy}
                    allTeachers={allTeachers}
                    onAssign={handleAssign}
                    onRemove={handleRemove}
                />
            )}

            <AlertDialog open={!!deletingPolicy} onOpenChange={v => { if (!v) setDeletingPolicy(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deletePolicyTitle', { name: deletingPolicy?.name ?? '' })}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('deletePolicyDesc')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deletingLoading}>{t('cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={deletingLoading}
                            onClick={handleDeletePolicy}
                        >
                            {deletingLoading ? t('deleting') : t('deletePolicy')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
