'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { useAcademic } from '@/context/AcademicContext'
import { guessAcademicYear } from '@/lib/utils/academic-year'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { IconArrowLeft, IconPlus, IconTrash, IconEdit, IconDeviceFloppy } from '@tabler/icons-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface GradeLevel {
    id: string
    name: string
    order_index: number
}

interface FeeCategory {
    id: string
    name: string
    code: string
}

interface FeeStructure {
    id: string
    academic_year: string
    grade_level_id: string
    fee_category_id: string
    period_type: string
    period_name?: string | null
    period_number?: number | null
    amount: number
    due_date: string
    grade_level?: { name: string }
    fee_category?: { name: string }
}

// period_type values where a grade can have several structures of the same
// type (Term 1, Term 2, Term 3 …) — these need a period_number to tell them
// apart when generating fees. annual/one_time normally have a single active
// structure per grade+year, so no number is needed there.
const MULTI_INSTANCE_PERIOD_TYPES = ['termly', 'quarterly', 'semester']

export default function FeeStructuresPage() {
    const t = useTranslations('fees.structures')
    const router = useRouter()
    const { profile } = useAuth()
    const { selectedCampus } = useCampus()
    const { academicYears, currentAcademicYear } = useAcademic()
    // The backend now allows fee categories/structures to target a campus
    // other than the admin's own home school (as long as it's a real child
    // campus) — it used to hard-reject anything but an exact match to
    // profile.school_id, so a campus switched to via the sidebar could never
    // actually have its own fee structures managed here.
    const schoolId = selectedCampus?.id || profile?.school_id || ''
    // Grade levels are also looked up per-campus; kept as a separate alias
    // since it's semantically about grades, even though it's the same value now.
    const gradeScopeId = schoolId

    // Placeholder until the school's actual current academic year loads below —
    // never the hardcoded fallback this used to be, which could silently
    // diverge from what /admin/fees/generate defaults to (the root cause of
    // "created a fee structure but no fees were generated" reports).
    const [academicYear, setAcademicYear] = useState(() => guessAcademicYear(new Date()))
    const didDefaultAcademicYear = useRef(false)
    useEffect(() => {
        if (!didDefaultAcademicYear.current && currentAcademicYear?.name) {
            didDefaultAcademicYear.current = true
            setAcademicYear(currentAcademicYear.name)
        }
    }, [currentAcademicYear])
    const [editingStructure, setEditingStructure] = useState<FeeStructure | null>(null)
    const [isAddingNew, setIsAddingNew] = useState(false)
    const formCardRef = useRef<HTMLDivElement>(null)

    // Form state
    // grade_level_id: used when editing an existing structure (one row = one grade)
    // grade_level_ids: used when creating new structures — selecting multiple grades
    //   that share the same fee creates one structure row per selected grade.
    const [formData, setFormData] = useState({
        grade_level_id: '',
        grade_level_ids: [] as string[],
        fee_category_id: '',
        period_type: 'monthly',
        period_name: '',
        period_number: '',
        amount: '',
        due_date: ''
    })

    // Fetch grade levels
    const { data: gradeLevels } = useSWR<GradeLevel[]>(
        gradeScopeId ? `grade-levels-${gradeScopeId}` : null,
        async () => {
            const { createClient } = await import('@/lib/supabase/client')
            const token = (await createClient().auth.getSession()).data.session?.access_token
            const res = await fetch(`${API_BASE}/academics/grades?school_id=${gradeScopeId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const json = await res.json()
            return json.success ? json.data : []
        }
    )

    // Fetch fee categories
    const { data: categories } = useSWR<FeeCategory[]>(
        schoolId ? `fee-categories-${schoolId}` : null,
        async () => {
            const { createClient } = await import('@/lib/supabase/client')
            const token = (await createClient().auth.getSession()).data.session?.access_token
            const res = await fetch(`${API_BASE}/fees/categories?school_id=${schoolId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const json = await res.json()
            return json.success ? json.data : []
        }
    )

    // Fetch fee structures
    const { data: structures, mutate: mutateStructures, isLoading } = useSWR<FeeStructure[]>(
        schoolId ? `fee-structures-${schoolId}-${academicYear}` : null,
        async () => {
            const { createClient } = await import('@/lib/supabase/client')
            const token = (await createClient().auth.getSession()).data.session?.access_token
            const res = await fetch(`${API_BASE}/fees/structures?school_id=${schoolId}&academic_year=${academicYear}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const json = await res.json()
            return json.success ? json.data : []
        }
    )

    const handleSave = async () => {
        const selectedGradeIds = editingStructure
            ? (formData.grade_level_id ? [formData.grade_level_id] : [])
            : formData.grade_level_ids

        if (selectedGradeIds.length === 0 || !formData.fee_category_id || !formData.amount || !formData.due_date) {
            toast.error(t('fillRequired'))
            return
        }

        const needsPeriodNumber = MULTI_INSTANCE_PERIOD_TYPES.includes(formData.period_type)
        if (needsPeriodNumber && !formData.period_number) {
            // Without this, fee generation can't tell "Term 1" apart from
            // "Term 2" for the same grade — see generateMonthlyFees's
            // period_number filter.
            toast.error(t('periodNumberRequired'))
            return
        }

        try {
            const { createClient } = await import('@/lib/supabase/client')
            const token = (await createClient().auth.getSession()).data.session?.access_token

            const basePayload = {
                school_id: schoolId,
                academic_year: academicYear,
                fee_category_id: formData.fee_category_id,
                period_type: formData.period_type,
                period_name: formData.period_type === 'monthly' ? null : (formData.period_name || null),
                period_number: needsPeriodNumber && formData.period_number ? parseInt(formData.period_number, 10) : null,
                amount: parseFloat(formData.amount),
                due_date: formData.due_date,
            }

            if (editingStructure) {
                const response = await fetch(`${API_BASE}/fees/structures/${editingStructure.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ ...basePayload, grade_level_id: selectedGradeIds[0] })
                })
                const result = await response.json()
                if (result.success) {
                    toast.success(t('updateSuccess'))
                    mutateStructures()
                    resetForm()
                } else {
                    toast.error(result.error || t('failed'))
                }
                return
            }

            // Create mode: one structure row per selected grade level.
            const results = await Promise.all(selectedGradeIds.map(async (gradeLevelId) => {
                const response = await fetch(`${API_BASE}/fees/structures`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ ...basePayload, grade_level_id: gradeLevelId })
                })
                return response.json()
            }))

            const failures = results.filter((r) => !r.success)
            const successCount = results.length - failures.length

            if (successCount > 0) {
                // Saving a fee structure only creates a template — it does not
                // bill any student yet. That requires the separate "Generate
                // Fees" step, which is easy to miss (this is the #1 support
                // report: "added a fee but nothing shows up"). Surface it
                // directly instead of a plain success toast, pre-filtered to
                // the grade(s) just created.
                toast.success(t('createSuccess'), {
                    description: t('createSuccessGenerateHint'),
                    duration: 10000,
                    action: {
                        label: t('generateFeesAction'),
                        onClick: () => {
                            const gradesParam = selectedGradeIds.join(',')
                            router.push(`/admin/fees/generate?grades=${encodeURIComponent(gradesParam)}`)
                        }
                    }
                })
                mutateStructures()
            }
            if (failures.length > 0) {
                toast.error(failures[0].error || t('failed'))
            }
            if (successCount > 0) {
                resetForm()
            }
        } catch (error: any) {
            toast.error(error.message || t('failed'))
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm(t('deleteConfirm'))) return

        try {
            const { createClient } = await import('@/lib/supabase/client')
            const token = (await createClient().auth.getSession()).data.session?.access_token
            
            const response = await fetch(`${API_BASE}/fees/structures/${id}?school_id=${schoolId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })

            const result = await response.json()

            if (result.success) {
                toast.success(t('deleteSuccess'))
                mutateStructures()
            } else {
                toast.error(result.error || t('failed'))
            }
        } catch (error: any) {
            toast.error(error.message || t('failed'))
        }
    }

    const handleEdit = (structure: FeeStructure) => {
        setEditingStructure(structure)
        setFormData({
            grade_level_id: structure.grade_level_id,
            grade_level_ids: [],
            fee_category_id: structure.fee_category_id,
            period_type: structure.period_type,
            period_name: structure.period_name || '',
            period_number: structure.period_number != null ? String(structure.period_number) : '',
            amount: structure.amount.toString(),
            due_date: structure.due_date.split('T')[0]
        })
        setIsAddingNew(true)
        // The form card sits above the structures table — without this, clicking
        // Edit while scrolled down to the table silently opens the form off-screen,
        // which reads as "the edit button doesn't do anything."
        requestAnimationFrame(() => formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }

    const resetForm = () => {
        setEditingStructure(null)
        setIsAddingNew(false)
        setFormData({
            grade_level_id: '',
            grade_level_ids: [],
            fee_category_id: '',
            period_type: 'monthly',
            period_name: '',
            period_number: '',
            amount: '',
            due_date: ''
        })
    }

    const toggleGradeSelection = (gradeId: string) => {
        setFormData((prev) => ({
            ...prev,
            grade_level_ids: prev.grade_level_ids.includes(gradeId)
                ? prev.grade_level_ids.filter((id) => id !== gradeId)
                : [...prev.grade_level_ids, gradeId]
        }))
    }

    const formatCurrency = (amount: number) => {
        return `${amount?.toLocaleString() || 0}`
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/fees/settings">
                        <IconArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">{t('title')}</h1>
                    <p className="text-muted-foreground">{t('subtitle')}</p>
                </div>
                <Button onClick={() => {
                    setIsAddingNew(true)
                    requestAnimationFrame(() => formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
                }}>
                    <IconPlus className="h-4 w-4 mr-2" />
                    {t('addNew')}
                </Button>
            </div>

            {/* Academic Year Filter */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('academicYear')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Select value={academicYear} onValueChange={setAcademicYear}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {/* Sourced from the school's actual academic_years records
                                (same list /admin/settings/academic-years manages) instead
                                of a hardcoded set of years, so this never runs out of
                                options or offers a year the school doesn't really have. */}
                            {(academicYears.length > 0
                                ? Array.from(new Set(academicYears.map((y) => y.name)))
                                : [academicYear]
                            ).map((name) => (
                                <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {/* Add/Edit Form */}
            {isAddingNew && (
                <Card ref={formCardRef}>
                    <CardHeader>
                        <CardTitle>{editingStructure ? t('editStructure') : t('addStructure')}</CardTitle>
                        <CardDescription>{t('structureDetails')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>{t('selectGrade')} *</Label>
                                {editingStructure ? (
                                    <Select
                                        value={formData.grade_level_id}
                                        onValueChange={(v) => setFormData({ ...formData, grade_level_id: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={t('selectGrade')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {gradeLevels?.map((grade) => (
                                                <SelectItem key={grade.id} value={grade.id}>{grade.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <div className="border rounded-md p-2 max-h-48 overflow-auto space-y-1">
                                        {gradeLevels && gradeLevels.length > 0 ? (
                                            <>
                                                <div
                                                    className="flex items-center gap-2 p-1.5 hover:bg-accent rounded cursor-pointer border-b mb-1"
                                                    onClick={() => setFormData((prev) => ({
                                                        ...prev,
                                                        grade_level_ids: prev.grade_level_ids.length === gradeLevels.length
                                                            ? []
                                                            : gradeLevels.map((g) => g.id)
                                                    }))}
                                                >
                                                    <Checkbox
                                                        checked={formData.grade_level_ids.length === gradeLevels.length}
                                                        onCheckedChange={() => setFormData((prev) => ({
                                                            ...prev,
                                                            grade_level_ids: prev.grade_level_ids.length === gradeLevels.length
                                                                ? []
                                                                : gradeLevels.map((g) => g.id)
                                                        }))}
                                                    />
                                                    <label className="flex-1 cursor-pointer text-sm font-medium">{t('selectAll') || 'Select All'}</label>
                                                </div>
                                            {gradeLevels.map((grade) => (
                                                <div
                                                    key={grade.id}
                                                    className="flex items-center gap-2 p-1.5 hover:bg-accent rounded cursor-pointer"
                                                    onClick={() => toggleGradeSelection(grade.id)}
                                                >
                                                    <Checkbox
                                                        checked={formData.grade_level_ids.includes(grade.id)}
                                                        onCheckedChange={() => toggleGradeSelection(grade.id)}
                                                    />
                                                    <label className="flex-1 cursor-pointer text-sm">{grade.name}</label>
                                                </div>
                                            ))}
                                            </>
                                        ) : (
                                            <p className="text-sm text-muted-foreground p-1.5">{t('notAvailable')}</p>
                                        )}
                                    </div>
                                )}
                                {!editingStructure && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {t('selectMultipleGradesHint')}
                                    </p>
                                )}
                            </div>

                            <div>
                                <Label>{t('selectCategory')} *</Label>
                                <Select
                                    value={formData.fee_category_id}
                                    onValueChange={(v) => setFormData({ ...formData, fee_category_id: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('selectCategory')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories?.map((cat) => (
                                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>{t('periodType')} *</Label>
                                <Select
                                    value={formData.period_type}
                                    onValueChange={(v) => setFormData({ ...formData, period_type: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="monthly">{t('monthly')}</SelectItem>
                                        <SelectItem value="termly">{t('termly')}</SelectItem>
                                        <SelectItem value="quarterly">{t('quarterly')}</SelectItem>
                                        <SelectItem value="semester">{t('semester')}</SelectItem>
                                        <SelectItem value="annual">{t('annual')}</SelectItem>
                                        <SelectItem value="one_time">{t('oneTime')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {formData.period_type !== 'monthly' && (
                                <div className="grid grid-cols-2 gap-3">
                                    {MULTI_INSTANCE_PERIOD_TYPES.includes(formData.period_type) && (
                                        <div>
                                            <Label>{t('periodNumber')} *</Label>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={formData.period_number}
                                                onChange={(e) => setFormData({ ...formData, period_number: e.target.value })}
                                                placeholder="1"
                                            />
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {t('periodNumberHint')}
                                            </p>
                                        </div>
                                    )}
                                    <div>
                                        <Label>{t('periodName')}</Label>
                                        <Input
                                            value={formData.period_name}
                                            onChange={(e) => setFormData({ ...formData, period_name: e.target.value })}
                                            placeholder={t('periodNamePlaceholder')}
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t('periodNameHint')}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div>
                                <Label>{t('amount')} *</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>

                            <div>
                                <Label>{t('dueDate')} *</Label>
                                <Input
                                    type="date"
                                    value={formData.due_date}
                                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button onClick={handleSave}>
                                <IconDeviceFloppy className="h-4 w-4 mr-2" />
                                {editingStructure ? t('update') || 'Update' : t('save') || 'Save'}
                            </Button>
                            <Button variant="outline" onClick={resetForm}>
                                {t('cancel') || 'Cancel'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Fee Structures Table */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('currentStructures')}</CardTitle>
                    <CardDescription>
                        {t('structuresCount', { count: structures?.length || 0, year: academicYear })}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-2">
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t('gradeLevel') || 'Grade'}</TableHead>
                                        <TableHead>{t('category') || 'Category'}</TableHead>
                                        <TableHead>{t('period') || 'Period'}</TableHead>
                                        <TableHead>{t('amount')}</TableHead>
                                        <TableHead>{t('dueDate')}</TableHead>
                                        <TableHead className="text-end">{t('actions') || 'Actions'}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {structures && structures.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                {t('noStructures')}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        structures?.map((structure) => (
                                            <TableRow key={structure.id}>
                                                <TableCell className="font-medium">
                                                    {structure.grade_level?.name || t('notAvailable')}
                                                </TableCell>
                                                <TableCell>{structure.fee_category?.name || t('notAvailable')}</TableCell>
                                                <TableCell className="capitalize">
                                                    {t(structure.period_type) || structure.period_type}
                                                    {structure.period_name && (
                                                        <span className="block text-xs text-muted-foreground normal-case">{structure.period_name}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>{formatCurrency(structure.amount)}</TableCell>
                                                <TableCell>{new Date(structure.due_date).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-end">
                                                    <div className="flex gap-1 justify-end">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleEdit(structure)}
                                                        >
                                                            <IconEdit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDelete(structure.id)}
                                                        >
                                                            <IconTrash className="h-4 w-4 text-red-500" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
