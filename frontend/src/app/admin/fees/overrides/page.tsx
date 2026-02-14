'use client'

import { useState, useEffect, useMemo } from 'react'
import { useCampus } from '@/context/CampusContext'
import { useAuth } from '@/context/AuthContext'
import {
    getAllSchoolFeeOverrides,
    getFeeCategories,
    StudentFeeOverride,
    FeeCategory
} from '@/lib/api/fees'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
    IconSearch,
    IconUsers,
    IconPlus,
    IconRefresh,
    IconChevronLeft,
    IconChevronRight,
    IconAdjustments,
    IconEdit,
    IconTrash
} from '@tabler/icons-react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import StudentFeeOverrideModal from '@/components/admin/StudentFeeOverrideModal'
import { toast } from 'sonner'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Student {
    id: string
    student_number?: string
    profile?: { first_name: string; last_name: string }
    profiles?: { first_name: string; last_name: string }
    grade_level?: string
    grade_levels?: { id: string; name: string }
    section_id?: string
    sections?: { id: string; name: string }
}

interface GradeLevel {
    id: string
    name: string
    order_index: number
}

interface Section {
    id: string
    name: string
    grade_level_id: string
}

interface AcademicYear {
    id: string
    name: string
    is_current: boolean
}

export default function FeeOverridesPage() {
    const { profile } = useAuth()
    const { selectedCampus, loading: campusLoading } = useCampus() || {}
    const schoolId = selectedCampus?.id || profile?.school_id

    // State
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedGradeId, setSelectedGradeId] = useState<string>('all')
    const [selectedSectionId, setSelectedSectionId] = useState<string>('all')
    const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('all')
    const [page, setPage] = useState(1)
    const [pageSize] = useState(20)
    const [loading, setLoading] = useState(false)
    const [students, setStudents] = useState<Student[]>([])
    const [overrides, setOverrides] = useState<StudentFeeOverride[]>([])
    const [feeCategories, setFeeCategories] = useState<FeeCategory[]>([])

    // Modal state
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    // Fetch grade levels
    const { data: gradeLevels } = useSWR<GradeLevel[]>(
        schoolId ? `grade-levels-override-${schoolId}` : null,
        async () => {
            const supabase = createClient()
            const token = (await supabase.auth.getSession()).data.session?.access_token
            const res = await fetch(`${API_BASE}/api/academics/grades?school_id=${schoolId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const json = await res.json()
            return json.success ? json.data : []
        }
    )

    // Fetch sections
    const { data: sections } = useSWR<Section[]>(
        selectedGradeId && selectedGradeId !== 'all' ? `sections-override-${selectedGradeId}` : null,
        async () => {
            const supabase = createClient()
            const token = (await supabase.auth.getSession()).data.session?.access_token
            const res = await fetch(`${API_BASE}/api/academics/sections?grade_level_id=${selectedGradeId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const json = await res.json()
            return json.success ? json.data : []
        }
    )

    // Fetch academic years
    const { data: academicYears } = useSWR<AcademicYear[]>(
        schoolId ? `academic-years-override-${schoolId}` : null,
        async () => {
            const supabase = createClient()
            const token = (await supabase.auth.getSession()).data.session?.access_token
            const res = await fetch(`${API_BASE}/api/academics/academic-years?school_id=${schoolId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const json = await res.json()
            if (json.success && json.data) {
                // Set default to current academic year
                const currentYear = json.data.find((y: AcademicYear) => y.is_current)
                if (currentYear) {
                    setSelectedAcademicYear(currentYear.name)
                }
            }
            return json.success ? json.data : []
        }
    )

    // Load students when campus or grade changes
    useEffect(() => {
        if (schoolId && gradeLevels) {
            loadStudents()
        }
    }, [schoolId, selectedGradeId, gradeLevels])

    // Load overrides when academic year changes
    useEffect(() => {
        if (schoolId) {
            loadOverrides()
        }
    }, [schoolId, selectedAcademicYear])

    // Load fee categories
    useEffect(() => {
        if (schoolId) {
            loadFeeCategories()
        }
    }, [schoolId])

    const loadStudents = async () => {
        if (!schoolId) return
        setLoading(true)
        setStudents([]) // Clear students on reload
        try {
            const supabase = createClient()
            const token = (await supabase.auth.getSession()).data.session?.access_token
            
            const params = new URLSearchParams()
            // Use campus_id for campus-specific filtering (backend expects campus_id, not school_id)
            params.append('campus_id', schoolId)
            // Backend expects grade_level (name), not grade_level_id
            if (selectedGradeId && selectedGradeId !== 'all' && gradeLevels) {
                const selectedGrade = gradeLevels.find(g => g.id === selectedGradeId)
                if (selectedGrade) {
                    params.append('grade_level', selectedGrade.name)
                }
            }
            params.append('limit', '500')

            const res = await fetch(`${API_BASE}/api/students?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const json = await res.json()
            if (json.success) {
                setStudents(json.data || [])
            }
        } catch (error) {
            console.error('Failed to load students:', error)
            toast.error('Failed to load students')
        } finally {
            setLoading(false)
        }
    }

    const loadOverrides = async () => {
        if (!schoolId) return
        try {
            const result = await getAllSchoolFeeOverrides({
                schoolId,
                academicYear: selectedAcademicYear === 'all' ? undefined : selectedAcademicYear,
                limit: 1000
            })
            setOverrides(result.data || [])
        } catch (error) {
            console.error('Failed to load overrides:', error)
        }
    }

    const loadFeeCategories = async () => {
        if (!schoolId) return
        try {
            const categories = await getFeeCategories(schoolId)
            setFeeCategories(categories)
        } catch (error) {
            console.error('Failed to load fee categories:', error)
        }
    }

    // Reset all filters and clear data when campus changes
    useEffect(() => {
        setSelectedGradeId('all')
        setSelectedSectionId('all')
        setSearchQuery('')
        setPage(1)
        setStudents([])
        setOverrides([])
    }, [schoolId])

    // Reset section when grade changes
    useEffect(() => {
        setSelectedSectionId('all')
    }, [selectedGradeId])

    // Reset page when filters change
    useEffect(() => {
        setPage(1)
    }, [selectedGradeId, selectedSectionId, searchQuery])

    // Get override count for a student
    const getStudentOverrideCount = (studentId: string) => {
        return overrides.filter(o => o.student_id === studentId && o.is_active).length
    }

    // Get overrides for a student
    const getStudentOverrides = (studentId: string) => {
        return overrides.filter(o => o.student_id === studentId && o.is_active)
    }

    // Get student name handling both profile and profiles
    const getStudentName = (student: Student) => {
        const p = student.profile || student.profiles
        return p ? `${p.first_name} ${p.last_name}` : 'Unknown'
    }

    // Get grade name handling both grade_level string and grade_levels object
    const getGradeName = (student: Student) => {
        return student.grade_levels?.name || student.grade_level || '-'
    }

    // Get section name by looking up in sections array
    const getSectionName = (student: Student) => {
        if (student.sections?.name) return student.sections.name
        if (student.section_id && sections) {
            const section = sections.find(s => s.id === student.section_id)
            return section?.name || '-'
        }
        return '-'
    }

    // Filter and paginate students
    const filteredStudents = useMemo(() => {
        let result = students

        // Filter by section (client-side since backend doesn't support it)
        if (selectedSectionId && selectedSectionId !== 'all') {
            result = result.filter(s => s.section_id === selectedSectionId)
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            result = result.filter(s =>
                getStudentName(s).toLowerCase().includes(query) ||
                s.student_number?.toLowerCase().includes(query)
            )
        }

        return result
    }, [students, searchQuery, selectedSectionId])

    const paginatedStudents = useMemo(() => {
        const start = (page - 1) * pageSize
        return filteredStudents.slice(start, start + pageSize)
    }, [filteredStudents, page, pageSize])

    const totalPages = Math.ceil(filteredStudents.length / pageSize)

    const handleOpenModal = (student: Student) => {
        setSelectedStudent(student)
        setIsModalOpen(true)
    }

    const handleCloseModal = () => {
        setIsModalOpen(false)
        setSelectedStudent(null)
    }

    const handleOverrideUpdated = () => {
        loadOverrides()
    }

    if (campusLoading) {
        return (
            <div className="container mx-auto py-6">
                <Skeleton className="h-8 w-64 mb-4" />
                <Skeleton className="h-96 w-full" />
            </div>
        )
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <IconAdjustments className="h-8 w-8" />
                        Fee Overrides
                    </h1>
                    <p className="text-muted-foreground">
                        Set custom fee amounts for individual students
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => {
                        loadStudents()
                        loadOverrides()
                    }}
                >
                    <IconRefresh className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Info Banner */}
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                        <IconAdjustments className="text-blue-600 dark:text-blue-400 mt-0.5" size={20} />
                        <div className="text-sm text-blue-700 dark:text-blue-300">
                            <p className="font-medium">How Fee Overrides Work</p>
                            <p className="mt-1 text-blue-600 dark:text-blue-400">
                                Override the default fee structure amount for specific students. When fees are generated,
                                students with overrides will be charged the custom amount instead of the grade-level fee.
                                Existing fees are not affected - overrides only apply to future fee generation.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Filters */}
            <Card>
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <IconUsers className="h-5 w-5" />
                        Students
                    </CardTitle>
                    <CardDescription>
                        Select a student to manage their fee overrides
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Filter Row */}
                    <div className="flex flex-wrap gap-4 mb-6">
                        {/* Search */}
                        <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search students..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        {/* Grade Filter */}
                        <div className="min-w-[150px]">
                            <Select value={selectedGradeId} onValueChange={setSelectedGradeId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Grades" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Grades</SelectItem>
                                    {gradeLevels?.map((grade) => (
                                        <SelectItem key={grade.id} value={grade.id}>
                                            {grade.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Section Filter */}
                        <div className="min-w-[150px]">
                            <Select 
                                value={selectedSectionId} 
                                onValueChange={setSelectedSectionId}
                                disabled={selectedGradeId === 'all'}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="All Sections" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Sections</SelectItem>
                                    {sections?.map((section) => (
                                        <SelectItem key={section.id} value={section.id}>
                                            {section.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Academic Year Filter */}
                        <div className="min-w-[180px]">
                            <Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Academic Year" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Years</SelectItem>
                                    {academicYears?.map((year) => (
                                        <SelectItem key={year.id} value={year.name}>
                                            {year.name} {year.is_current ? '(Current)' : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Students Table */}
                    {loading ? (
                        <div className="space-y-2">
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} className="h-16 w-full" />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Student</TableHead>
                                        <TableHead>Grade</TableHead>
                                        <TableHead>Section</TableHead>
                                        <TableHead>Active Overrides</TableHead>
                                        <TableHead>Override Details</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedStudents.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                No students found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedStudents.map((student) => {
                                            const overrideCount = getStudentOverrideCount(student.id)
                                            const studentOverrides = getStudentOverrides(student.id)
                                            return (
                                                <TableRow key={student.id} className="cursor-pointer hover:bg-muted/50">
                                                    <TableCell 
                                                        className="font-medium"
                                                        onClick={() => handleOpenModal(student)}
                                                    >
                                                        {getStudentName(student)}
                                                        {student.student_number && (
                                                            <span className="block text-xs text-muted-foreground">
                                                                {student.student_number}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell onClick={() => handleOpenModal(student)}>
                                                        {getGradeName(student)}
                                                    </TableCell>
                                                    <TableCell onClick={() => handleOpenModal(student)}>
                                                        {getSectionName(student)}
                                                    </TableCell>
                                                    <TableCell onClick={() => handleOpenModal(student)}>
                                                        {overrideCount > 0 ? (
                                                            <Badge variant="default" className="bg-emerald-600">
                                                                {overrideCount} override{overrideCount !== 1 ? 's' : ''}
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-muted-foreground">
                                                                None
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell onClick={() => handleOpenModal(student)}>
                                                        {studentOverrides.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1">
                                                                {studentOverrides.slice(0, 3).map((o) => (
                                                                    <span 
                                                                        key={o.id} 
                                                                        className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded"
                                                                    >
                                                                        {o.fee_categories?.name}: Rs.{o.override_amount.toLocaleString()}
                                                                    </span>
                                                                ))}
                                                                {studentOverrides.length > 3 && (
                                                                    <span className="text-xs text-muted-foreground">
                                                                        +{studentOverrides.length - 3} more
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">
                                                                Using default fees
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleOpenModal(student)}
                                                        >
                                                            <IconEdit className="h-4 w-4 mr-1" />
                                                            Manage
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {/* Pagination */}
                    <div className="flex items-center justify-between pt-4 border-t mt-4">
                        <p className="text-sm text-muted-foreground">
                            Showing {filteredStudents.length > 0 ? (page - 1) * pageSize + 1 : 0} - {Math.min(page * pageSize, filteredStudents.length)} of {filteredStudents.length} students
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >
                                <IconChevronLeft className="h-4 w-4 mr-1" />
                                Previous
                            </Button>
                            <span className="text-sm px-2">
                                Page {page} of {totalPages || 1}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => p + 1)}
                                disabled={page >= totalPages}
                            >
                                Next
                                <IconChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Summary Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Override Summary</CardTitle>
                    <CardDescription>
                        {selectedAcademicYear !== 'all' 
                            ? `Active overrides for ${selectedAcademicYear}`
                            : 'Active overrides across all academic years'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-2xl font-bold text-emerald-600">
                                {overrides.filter(o => o.is_active).length}
                            </p>
                            <p className="text-sm text-muted-foreground">Total Overrides</p>
                        </div>
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-2xl font-bold text-blue-600">
                                {new Set(overrides.filter(o => o.is_active).map(o => o.student_id)).size}
                            </p>
                            <p className="text-sm text-muted-foreground">Students with Overrides</p>
                        </div>
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-2xl font-bold text-purple-600">
                                {new Set(overrides.filter(o => o.is_active).map(o => o.fee_category_id)).size}
                            </p>
                            <p className="text-sm text-muted-foreground">Categories Affected</p>
                        </div>
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-2xl font-bold text-orange-600">
                                {feeCategories.length}
                            </p>
                            <p className="text-sm text-muted-foreground">Total Fee Categories</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Fee Override Modal */}
            {selectedStudent && schoolId && (
                <StudentFeeOverrideModal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    student={selectedStudent}
                    schoolId={schoolId}
                    onUpdated={handleOverrideUpdated}
                />
            )}
        </div>
    )
}
