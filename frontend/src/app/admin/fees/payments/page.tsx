'use client'

import { useState, useMemo, useEffect } from 'react'
import { useCampus } from '@/context/CampusContext'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { MultiSelectPopover } from '@/components/shared/MultiSelectPopover'
import { IconLoader, IconSearch, IconDownload, IconUsers, IconBell } from '@tabler/icons-react'
import useSWR from 'swr'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface GradeLevel {
    id: string
    name: string
    order_index: number
}

interface SectionOption {
    id: string
    name: string
    grade_level_id: string
}

interface ParentLink {
    parent_id: string
    relationship: string
    parents: {
        id: string
        address: string | null
        city: string | null
        state: string | null
        zip_code: string | null
        profiles: {
            first_name: string
            last_name: string
        }
    }
}

interface Student {
    id: string
    student_number: string
    grade_level: string
    custom_fields?: {
        ethnicity?: string
        gender?: string
        address?: string
        city?: string
        state?: string
        zip_code?: string
    }
    profiles: {
        first_name: string
        last_name: string
        email?: string
        phone?: string
    }
    grade_levels: {
        id: string
        name: string
    }
    sections?: {
        id: string
        name: string
    }
    parent_student_links?: ParentLink[]
}

interface FamilyGroup {
    familyId: string
    familyName: string
    students: Student[]
}

async function fetchGrades(schoolId: string): Promise<GradeLevel[]> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    const res = await fetch(`${API_BASE}/academics/grades?school_id=${schoolId}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
    })
    const json = await res.json()
    return json.success ? json.data : []
}

// Fetches all sections for the campus (no grade filter) — the grade↔section
// cascade is applied client-side since a payments filter may span multiple
// selected grades at once.
async function fetchSections(schoolId: string): Promise<SectionOption[]> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    const res = await fetch(`${API_BASE}/academics/sections?school_id=${schoolId}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
    })
    const json = await res.json()
    return json.success ? json.data : []
}

async function fetchStudentsForPayments(schoolId: string, gradeIds?: string[], sectionIds?: string[]) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    const params = new URLSearchParams({ school_id: schoolId, limit: '500' })
    if (gradeIds && gradeIds.length > 0) params.set('grade_level_id', gradeIds.join(','))
    if (sectionIds && sectionIds.length > 0) params.set('section_id', sectionIds.join(','))

    const res = await fetch(`${API_BASE}/fees/payments/students?${params}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return json.data
}

type ViewMode = 'original' | 'expanded' | 'family'

export default function PaymentsPage() {
    const t = useTranslations('fees.payments')
    const tCommon = useTranslations('common')
    const { selectedCampus, loading: campusLoading } = useCampus() || {}
    const schoolId = selectedCampus?.id

    const [searchQuery, setSearchQuery] = useState('')
    const [viewMode, setViewMode] = useState<ViewMode>('original')
    const [gradeIds, setGradeIds] = useState<string[]>([])
    const [sectionIds, setSectionIds] = useState<string[]>([])
    const [gradePopoverOpen, setGradePopoverOpen] = useState(false)
    const [sectionPopoverOpen, setSectionPopoverOpen] = useState(false)

    // Fetch grades
    const { data: grades } = useSWR<GradeLevel[]>(
        schoolId ? ['grades-payments', schoolId] : null,
        () => fetchGrades(schoolId!)
    )

    // Fetch all sections for the campus
    const { data: allSections } = useSWR<SectionOption[]>(
        schoolId ? ['sections-payments', schoolId] : null,
        () => fetchSections(schoolId!)
    )

    // Sections available for the currently-selected grades (cascading filter)
    const sections = gradeIds.length > 0
        ? allSections?.filter(s => gradeIds.includes(s.grade_level_id))
        : allSections

    // Drop any selected section that's no longer visible once the grade selection narrows
    useEffect(() => {
        if (gradeIds.length === 0 || !sections) return
        const visibleIds = new Set(sections.map(s => s.id))
        setSectionIds(prev => prev.filter(id => visibleIds.has(id)))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gradeIds.join(',')])

    // Fetch students (no server-side search, handled client-side)
    const { data: students, isLoading } = useSWR<Student[]>(
        schoolId ? ['payment-students', schoolId, gradeIds.join(','), sectionIds.join(',')] : null,
        () => fetchStudentsForPayments(schoolId!, gradeIds, sectionIds),
        { revalidateOnFocus: false }
    )

    // Format student name
    const formatStudentName = (student: Student) => {
        const { first_name, last_name } = student.profiles
        return `${first_name} ${last_name}`.toUpperCase()
    }

    // Filter students by search (client-side)
    const filteredStudents = useMemo(() => {
        if (!students) return []
        if (!searchQuery) return students

        const query = searchQuery.toLowerCase()
        return students.filter(s => {
            const name = formatStudentName(s).toLowerCase()
            return name.includes(query) || s.student_number?.toLowerCase().includes(query)
        })
    }, [students, searchQuery])

    // Group students by family (shared parent_id)
    const familyGroups = useMemo(() => {
        if (!filteredStudents.length) return []
        
        const familyMap = new Map<string, FamilyGroup>()
        const noFamily: Student[] = []
        
        filteredStudents.forEach(student => {
            const parentLinks = student.parent_student_links || []
            if (parentLinks.length === 0) {
                noFamily.push(student)
                return
            }
            
            // Use first parent's ID as family identifier
            const firstParent = parentLinks[0]?.parents
            if (!firstParent) {
                noFamily.push(student)
                return
            }
            
            const familyId = parentLinks[0].parent_id
            const familyName = `${firstParent.profiles?.first_name || ''} ${firstParent.profiles?.last_name || ''}`.trim() || 'Unknown Family'
            
            if (familyMap.has(familyId)) {
                familyMap.get(familyId)!.students.push(student)
            } else {
                familyMap.set(familyId, {
                    familyId,
                    familyName,
                    students: [student]
                })
            }
        })
        
        // Add students without family as individual groups
        noFamily.forEach(student => {
            familyMap.set(`no-family-${student.id}`, {
                familyId: `no-family-${student.id}`,
                familyName: formatStudentName(student),
                students: [student]
            })
        })
        
        return Array.from(familyMap.values()).sort((a, b) => a.familyName.localeCompare(b.familyName))
    }, [filteredStudents])

    // Get address info for student (from custom_fields or parent)
    const getStudentAddress = (student: Student) => {
        // Try custom_fields first
        if (student.custom_fields?.address) {
            return {
                address: student.custom_fields.address,
                city: student.custom_fields.city || '',
                state: student.custom_fields.state || '',
                zip_code: student.custom_fields.zip_code || ''
            }
        }
        // Fall back to parent address
        const parent = student.parent_student_links?.[0]?.parents
        if (parent?.address) {
            return {
                address: parent.address,
                city: parent.city || '',
                state: parent.state || '',
                zip_code: parent.zip_code || ''
            }
        }
        return { address: '', city: '', state: '', zip_code: '' }
    }

    // Handle export
    const handleExport = () => {
        if (!filteredStudents.length) return
        
        const headers = viewMode === 'expanded' 
            ? ['Student', 'Istudently ID', 'Grade Level', 'Ethnicity', 'Gender', 'Mailing Address', 'City', 'State', 'Zip Code']
            : ['Student', 'Istudently ID', 'Grade Level']
        
        const rows = filteredStudents.map(s => {
            const addr = getStudentAddress(s)
            const baseRow = [
                formatStudentName(s),
                s.student_number || '',
                s.grade_levels?.name || ''
            ]
            if (viewMode === 'expanded') {
                return [...baseRow,
                    s.custom_fields?.ethnicity || '',
                    s.custom_fields?.gender || '',
                    addr.address,
                    addr.city,
                    addr.state,
                    addr.zip_code
                ]
            }
            return baseRow
        })
        
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
        
        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'students_payments.csv'
        a.click()
        URL.revokeObjectURL(url)
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
                        <p className="text-muted-foreground text-center">{t('selectCampus')}</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-6 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <IconBell className="h-8 w-8 text-[#3d8fb5]" />
                <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
            </div>

            {/* View Toggle */}
            <div className="flex gap-2 text-sm">
                <button
                    onClick={() => setViewMode('original')}
                    className={`hover:underline ${viewMode === 'original' ? 'text-[#3d8fb5] font-semibold' : 'text-gray-600 dark:text-gray-400'}`}
                >
                    {t('originalView')}
                </button>
                <span>|</span>
                <button
                    onClick={() => setViewMode('expanded')}
                    className={`hover:underline ${viewMode === 'expanded' ? 'text-[#3d8fb5] font-semibold' : 'text-gray-600 dark:text-gray-400'}`}
                >
                    {t('expandedView')}
                </button>
                <span>|</span>
                <button
                    onClick={() => setViewMode('family')}
                    className={`hover:underline ${viewMode === 'family' ? 'text-[#3d8fb5] font-semibold' : 'text-gray-600 dark:text-gray-400'}`}
                >
                    {t('groupByFamily')}
                </button>
            </div>

            {/* Divider */}
            <hr className="border-gray-300 dark:border-gray-700" />

            {/* Grade / Section Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>{t('gradeLevel')}</Label>
                    <MultiSelectPopover
                        options={(grades || []).map(g => ({ id: g.id, label: g.name }))}
                        selectedIds={gradeIds}
                        onChange={setGradeIds}
                        placeholder={t('allGrades')}
                        emptyMessage={t('allGrades')}
                        open={gradePopoverOpen}
                        onOpenChange={setGradePopoverOpen}
                    />
                </div>
                <div className="space-y-2">
                    <Label>{tCommon('section')}</Label>
                    <MultiSelectPopover
                        options={(sections || []).map(s => ({ id: s.id, label: s.name }))}
                        selectedIds={sectionIds}
                        onChange={setSectionIds}
                        placeholder={t('allSections')}
                        emptyMessage={gradeIds.length === 0 ? t('selectGradeFirst') : t('allSections')}
                        open={sectionPopoverOpen}
                        onOpenChange={setSectionPopoverOpen}
                    />
                </div>
            </div>

            {/* Student Count and Search */}
            <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                        {viewMode === 'family'
                            ? t('foundFamilies', { count: familyGroups.length, studentCount: filteredStudents.length })
                            : viewMode === 'expanded'
                                ? t('foundStudentAddresses', { count: filteredStudents.length })
                                : t('foundStudents', { count: filteredStudents.length })
                        }
                    </p>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="p-1 h-auto"
                        onClick={handleExport}
                        title={t('exportCSV')}
                    >
                        <IconDownload className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    </Button>
                </div>
                <div className="relative">
                    <Input
                        placeholder={t('toolbar_search') || 'Search'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-64 pr-8"
                    />
                    <IconSearch className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
            </div>

            {/* Students Table */}
            <Card className="border-0 shadow-none">
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredStudents.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">{t('noStudentsFound')}</p>
                    ) : viewMode === 'family' ? (
                        // Family View
                        <div className="space-y-4">
                            {familyGroups.map(family => (
                                <div key={family.familyId} className="border rounded-lg overflow-hidden">
                                    <div className="bg-[#3d8fb5] text-white px-4 py-2 flex items-center gap-2">
                                        <IconUsers className="h-4 w-4" />
                                        <span className="font-semibold">{t('familyOf', { name: family.familyName })}</span>
                                        <span className="text-sm opacity-80">({family.students.length} {t('student')})</span>
                                    </div>
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-gray-100 dark:bg-gray-800">
                                                <TableHead className="text-[#3d8fb5] font-semibold">{t('student')}</TableHead>
                                                <TableHead className="text-[#3d8fb5] font-semibold">{t('istudentlyId')}</TableHead>
                                                <TableHead className="text-[#3d8fb5] font-semibold">{t('gradeLevel')}</TableHead>
                                                <TableHead className="text-[#3d8fb5] font-semibold">{tCommon('section')}</TableHead>
                                                <TableHead className="text-[#3d8fb5] font-semibold">{t('relationship')}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {family.students.map((student, index) => (
                                                <TableRow
                                                    key={student.id}
                                                    className={index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}
                                                >
                                                    <TableCell>
                                                        <Link
                                                            href={`/admin/fees/payments/${student.id}`}
                                                            className="text-[#3d8fb5] hover:underline"
                                                        >
                                                            {formatStudentName(student)}
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell>{student.student_number || '-'}</TableCell>
                                                    <TableCell>{student.grade_levels?.name || '-'}</TableCell>
                                                    <TableCell>{student.sections?.name || '-'}</TableCell>
                                                    <TableCell className="capitalize">
                                                        {student.parent_student_links?.[0]?.relationship || '-'}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ))}
                        </div>
                    ) : (
                        // Original or Expanded View
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-100 dark:bg-gray-800">
                                    <TableHead className="text-[#3d8fb5] font-semibold">{t('student')}</TableHead>
                                    <TableHead className="text-[#3d8fb5] font-semibold">{t('istudentlyId')}</TableHead>
                                    <TableHead className="text-[#3d8fb5] font-semibold">{t('gradeLevel')}</TableHead>
                                    <TableHead className="text-[#3d8fb5] font-semibold">{tCommon('section')}</TableHead>
                                    {viewMode === 'expanded' && (
                                        <>
                                            <TableHead className="text-[#3d8fb5] font-semibold">{t('ethnicity')}</TableHead>
                                            <TableHead className="text-[#3d8fb5] font-semibold">{t('gender')}</TableHead>
                                            <TableHead className="text-[#3d8fb5] font-semibold">{t('mailingAddress')}</TableHead>
                                            <TableHead className="text-[#3d8fb5] font-semibold">{t('city')}</TableHead>
                                            <TableHead className="text-[#3d8fb5] font-semibold">{t('state')}</TableHead>
                                            <TableHead className="text-[#3d8fb5] font-semibold">{t('zipCode')}</TableHead>
                                        </>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredStudents.map((student, index) => {
                                    const addr = getStudentAddress(student)
                                    return (
                                        <TableRow 
                                            key={student.id}
                                            className={index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}
                                        >
                                            <TableCell>
                                                <Link 
                                                    href={`/admin/fees/payments/${student.id}`}
                                                    className="text-[#3d8fb5] hover:underline"
                                                >
                                                    {formatStudentName(student)}
                                                </Link>
                                            </TableCell>
                                            <TableCell>{student.student_number || '-'}</TableCell>
                                            <TableCell>{student.grade_levels?.name || '-'}</TableCell>
                                            <TableCell>{student.sections?.name || '-'}</TableCell>
                                            {viewMode === 'expanded' && (
                                                <>
                                                    <TableCell>{student.custom_fields?.ethnicity || '-'}</TableCell>
                                                    <TableCell>{student.custom_fields?.gender || '-'}</TableCell>
                                                    <TableCell>{addr.address || '-'}</TableCell>
                                                    <TableCell>{addr.city || '-'}</TableCell>
                                                    <TableCell>{addr.state || '-'}</TableCell>
                                                    <TableCell>{addr.zip_code || '-'}</TableCell>
                                                </>
                                            )}
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
