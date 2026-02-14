'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { IconArrowLeft, IconFileInvoice, IconLoader2, IconUsers, IconUser } from '@tabler/icons-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { Combobox, ComboboxOption } from '@/components/ui/combobox'
import { getStudentFeeById } from '@/lib/api/fees'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface GradeLevel {
    id: string
    name: string
}

interface FeeCategory {
    id: string
    name: string
    code: string
}

interface Section {
    id: string
    name: string
    grade_level_id: string
}

interface Student {
    id: string
    student_number: string
    grade_level_id?: string
    grade_level?: string
    grade_levels?: { name: string }
    profile: {
        first_name: string
        last_name: string
    }
}

export default function GenerateFeesPage() {
    const { profile } = useAuth()
    const campusContext = useCampus()
    const selectedCampus = campusContext?.selectedCampus
    const schoolId = selectedCampus?.id || profile?.school_id || ''

    const currentDate = new Date()
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    
    // Shared state
    const [month, setMonth] = useState(nextMonth.getMonth() + 1)
    const [year, setYear] = useState(nextMonth.getFullYear())
    const [selectedCategories, setSelectedCategories] = useState<string[]>([])
    const [generating, setGenerating] = useState(false)

    // Bulk generation state
    const [gradeLevel, setGradeLevel] = useState('all')
    const [section, setSection] = useState('all')

    // Individual student state
    const [studentSearch, setStudentSearch] = useState('')
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
    const [dueDate, setDueDate] = useState('')

    // Generate academic year string
    const academicYear = useMemo(() => {
        if (month >= 8) return `${year}-${year + 1}`
        return `${year - 1}-${year}`
    }, [month, year])

    // Generate fee month string in YYYY-MM format for database (e.g., "2026-02")
    const feeMonth = useMemo(() => {
        return `${year}-${String(month).padStart(2, '0')}`
    }, [month, year])

    // Generate default due date
    const defaultDueDate = useMemo(() => {
        const date = new Date(year, month - 1, 10)
        return date.toISOString().split('T')[0]
    }, [month, year])

    // Fetch grade levels
    const { data: gradeLevels } = useSWR<GradeLevel[]>(
        schoolId ? `grade-levels-${schoolId}` : null,
        async () => {
            const { createClient } = await import('@/lib/supabase/client')
            const token = (await createClient().auth.getSession()).data.session?.access_token
            const res = await fetch(`${API_BASE}/api/academics/grades?school_id=${schoolId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const json = await res.json()
            return json.success ? json.data : []
        }
    )

    // Fetch sections for selected grade
    const { data: sections } = useSWR<Section[]>(
        gradeLevel && gradeLevel !== 'all' ? `sections-${gradeLevel}` : null,
        async () => {
            const { createClient } = await import('@/lib/supabase/client')
            const token = (await createClient().auth.getSession()).data.session?.access_token
            const res = await fetch(`${API_BASE}/api/academics/sections?grade_level_id=${gradeLevel}`, {
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
            const res = await fetch(`${API_BASE}/api/fees/categories?school_id=${schoolId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const json = await res.json()
            return json.success ? json.data : []
        }
    )

    // Search students
    const [studentsMap, setStudentsMap] = useState<Record<string, Student>>({})
    const { data: searchResults, isLoading: searchLoading } = useSWR<Student[]>(
        schoolId && studentSearch.length >= 2 ? `students-search-${schoolId}-${studentSearch}` : null,
        async () => {
            const { createClient } = await import('@/lib/supabase/client')
            const token = (await createClient().auth.getSession()).data.session?.access_token
            const res = await fetch(`${API_BASE}/api/students?campus_id=${schoolId}&search=${encodeURIComponent(studentSearch)}&limit=10`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const json = await res.json()
            const students = json.success ? json.data : []
            // Store students in map for lookup
            const newMap: Record<string, Student> = { ...studentsMap }
            students.forEach((s: Student) => { newMap[s.id] = s })
            setStudentsMap(newMap)
            return students
        },
        { revalidateOnFocus: false }
    )

    // Convert search results to Combobox options
    const studentOptions: ComboboxOption[] = useMemo(() => {
        if (!searchResults) return []
        return searchResults.map(student => ({
            value: student.id,
            label: `${student.profile?.first_name || ''} ${student.profile?.last_name || ''}`.trim() || 'Unknown',
            subtitle: `ID: ${student.student_number} • ${student.grade_levels?.name || student.grade_level || 'No Grade'}`
        }))
    }, [searchResults])

    // Handle student selection from combobox
    const handleStudentSelect = (studentId: string) => {
        if (studentId && studentsMap[studentId]) {
            setSelectedStudent(studentsMap[studentId])
        } else {
            setSelectedStudent(null)
        }
    }

    const handleCategoryToggle = (categoryId: string) => {
        setSelectedCategories(prev =>
            prev.includes(categoryId)
                ? prev.filter(id => id !== categoryId)
                : [...prev, categoryId]
        )
    }

    const handleSelectAllCategories = () => {
        if (!categories) return
        const allCategoryIds = categories.map(cat => cat.id)
        const allSelected = allCategoryIds.every(id => selectedCategories.includes(id))
        if (allSelected) {
            setSelectedCategories([])
        } else {
            setSelectedCategories(allCategoryIds)
        }
    }

    // Bulk generation
    const handleBulkGenerate = async () => {
        if (!schoolId) {
            toast.error('Missing school information')
            return
        }

        if (selectedCategories.length === 0) {
            toast.error('Please select at least one fee category')
            return
        }

        setGenerating(true)
        try {
            const { createClient } = await import('@/lib/supabase/client')
            const token = (await createClient().auth.getSession()).data.session?.access_token
            
            const allCategoryIds = categories?.map(cat => cat.id) || []
            const isAllCategoriesSelected = selectedCategories.length > 0 && 
                allCategoryIds.every(id => selectedCategories.includes(id)) &&
                selectedCategories.length === allCategoryIds.length
            
            const response = await fetch(`${API_BASE}/api/fees/generate-monthly`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    school_id: schoolId,
                    month,
                    year,
                    grade_level_id: gradeLevel === 'all' ? undefined : gradeLevel,
                    section_id: section === 'all' ? undefined : section,
                    category_ids: isAllCategoriesSelected ? null : selectedCategories
                })
            })

            const result = await response.json()

            if (result.success) {
                const message = isAllCategoriesSelected 
                    ? `Successfully generated ${result.data?.feesCreated || 0} comprehensive fee records for ${result.data?.studentsProcessed || 0} students`
                    : `Successfully generated ${result.data?.feesCreated || 0} fee records for ${result.data?.studentsProcessed || 0} students`
                toast.success(message)
            } else {
                toast.error(result.error || 'Failed to generate fees')
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to generate fees')
        } finally {
            setGenerating(false)
        }
    }
    // Direct print function after fee generation
    const printFeeChallan = async (feeId: string) => {
        try {
            // Use profile.school_id (not campus id) since fees are stored with school_id
            const actualSchoolId = profile?.school_id
            
            if (!actualSchoolId) {
                toast.error('Missing school information')
                return
            }

            // Fetch fee data directly
            const { createClient } = await import('@/lib/supabase/client')
            const token = (await createClient().auth.getSession()).data.session?.access_token
            
            const response = await fetch(`${API_BASE}/api/fees/students/${feeId}?school_id=${actualSchoolId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            
            const result = await response.json()
            
            if (!response.ok || !result.success || !result.data) {
                throw new Error(result.error || `Failed to load fee details (${response.status})`)
            }

            const feeData = result.data

            const studentName = feeData.students?.profiles
                ? `${feeData.students.profiles.first_name} ${feeData.students.profiles.last_name}`
                : 'Student'
            const studentNumber = feeData.students?.student_number || ''
            
            // Parse fee breakdown if available
            let feeBreakdown: any[] = []
            if (feeData.fee_breakdown) {
                try {
                    // Backend already parses it, but handle both cases
                    feeBreakdown = typeof feeData.fee_breakdown === 'string' 
                        ? JSON.parse(feeData.fee_breakdown)
                        : feeData.fee_breakdown
                    
                    // Ensure it's an array
                    if (!Array.isArray(feeBreakdown)) {
                        feeBreakdown = []
                    }
                } catch (e) {
                    // Failed to parse, will use base_amount instead
                }
            }

            const printWindow = window.open('', '_blank')
            if (!printWindow) {
                toast.error('Please allow popups to print the fee challan')
                return
            }

            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Fee Challan - ${studentName}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
                        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
                        .header h1 { margin: 0; color: #333; }
                        .header p { margin: 5px 0; color: #666; }
                        .student-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
                        .info-block { flex: 1; }
                        .info-block p { margin: 5px 0; }
                        .label { color: #666; font-size: 12px; }
                        .value { font-weight: bold; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                        th { background: #f5f5f5; }
                        .amount { text-align: right; }
                        .total-row { font-weight: bold; background: #f9f9f9; }
                        .status { padding: 5px 10px; border-radius: 4px; display: inline-block; }
                        .status-pending { background: #fef3c7; color: #92400e; }
                        .status-paid { background: #d1fae5; color: #065f46; }
                        .status-overdue { background: #fee2e2; color: #991b1b; }
                        .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
                        @media print { body { padding: 0; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>FEE CHALLAN</h1>
                        <p>Academic Year: ${feeData.academic_year}</p>
                        <p>Fee Month: ${feeData.fee_month || 'N/A'}</p>
                    </div>

                    <div class="student-info">
                        <div class="info-block">
                            <p><span class="label">Student Name:</span><br><span class="value">${studentName}</span></p>
                            <p><span class="label">Student Number:</span><br><span class="value">${studentNumber}</span></p>
                        </div>
                        <div class="info-block">
                            <p><span class="label">Due Date:</span><br><span class="value">${new Date(feeData.due_date).toLocaleDateString()}</span></p>
                            <p><span class="label">Status:</span><br><span class="status status-${feeData.status}">${feeData.status?.toUpperCase()}</span></p>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Fee Category</th>
                                <th class="amount">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${feeBreakdown && feeBreakdown.length > 0 ? (
                                feeBreakdown.map(item => `
                                    <tr>
                                        <td>${item.category_name || item.name || 'Fee'} ${item.category_code ? `(${item.category_code})` : ''}</td>
                                        <td class="amount">Rs. ${(item.amount || 0).toLocaleString()}</td>
                                    </tr>
                                `).join('')
                            ) : `
                                <tr>
                                    <td>Tuition Fee</td>
                                    <td class="amount">Rs. ${(feeData.base_amount || 0).toLocaleString()}</td>
                                </tr>
                            `}
                            ${feeData.services_amount && feeData.services_amount > 0 ? `
                                <tr>
                                    <td>Services</td>
                                    <td class="amount">Rs. ${feeData.services_amount.toLocaleString()}</td>
                                </tr>
                            ` : ''}
                            ${feeData.sibling_discount && feeData.sibling_discount > 0 ? `
                                <tr>
                                    <td>Sibling Discount</td>
                                    <td class="amount">- Rs. ${feeData.sibling_discount.toLocaleString()}</td>
                                </tr>
                            ` : ''}
                            ${feeData.custom_discount && feeData.custom_discount > 0 ? `
                                <tr>
                                    <td>Custom Discount</td>
                                    <td class="amount">- Rs. ${feeData.custom_discount.toLocaleString()}</td>
                                </tr>
                            ` : ''}
                            ${feeData.late_fee_applied && feeData.late_fee_applied > 0 ? `
                                <tr>
                                    <td>Late Fee</td>
                                    <td class="amount">Rs. ${feeData.late_fee_applied.toLocaleString()}</td>
                                </tr>
                            ` : ''}
                            <tr class="total-row">
                                <td>Total Amount</td>
                                <td class="amount">Rs. ${feeData.final_amount?.toLocaleString() || '0'}</td>
                            </tr>
                            ${feeData.amount_paid && feeData.amount_paid > 0 ? `
                                <tr>
                                    <td>Amount Paid</td>
                                    <td class="amount">Rs. ${feeData.amount_paid.toLocaleString()}</td>
                                </tr>
                                <tr class="total-row">
                                    <td>Balance Due</td>
                                    <td class="amount">Rs. ${(feeData.final_amount - feeData.amount_paid).toLocaleString()}</td>
                                </tr>
                            ` : ''}
                        </tbody>
                    </table>

                    <div class="footer">
                        <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
                        <p>This is a computer-generated document.</p>
                    </div>
                </body>
                </html>
            `)
            printWindow.document.close()
            
            // Auto-trigger print after a short delay
            setTimeout(() => {
                printWindow.print()
            }, 500)
        } catch (error) {
            toast.error('Failed to print fee challan')
        }
    }
    // Individual student generation
    const handleIndividualGenerate = async () => {
        if (!schoolId) {
            toast.error('Missing school information')
            return
        }

        if (!selectedStudent) {
            toast.error('Please select a student')
            return
        }

        if (!selectedStudent.grade_level_id) {
            toast.error('Selected student does not have a grade level assigned')
            return
        }
        if (selectedCategories.length === 0) {
            toast.error('Please select at least one fee category')
            return
        }

        setGenerating(true)
        try {
            const { createClient } = await import('@/lib/supabase/client')
            const token = (await createClient().auth.getSession()).data.session?.access_token
            
            const allCategoryIds = categories?.map(cat => cat.id) || []
            const isAllCategoriesSelected = selectedCategories.length > 0 && 
                allCategoryIds.every(id => selectedCategories.includes(id)) &&
                selectedCategories.length === allCategoryIds.length
            
            const response = await fetch(`${API_BASE}/api/fees/generate-for-student`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    student_id: selectedStudent.id,
                    grade_id: selectedStudent.grade_level_id,
                    service_ids: [],
                    category_ids: isAllCategoriesSelected ? null : selectedCategories,
                    academic_year: academicYear,
                    fee_month: feeMonth,
                    due_date: dueDate || defaultDueDate
                })
            })

            const result = await response.json()

            if (result.success && result.data?.id) {
                toast.success(`Fee generated! Opening print dialog...`)
                
                // Clear form
                setSelectedStudent(null)
                setStudentSearch('')
                
                // Auto-print the fee challan
                await printFeeChallan(result.data.id)
            } else {
                toast.error(result.error || 'Failed to generate fee')
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to generate fee')
        } finally {
            setGenerating(false)
        }
    }

    // Fee Categories Component (reusable)
    const FeeCategoriesSelector = () => (
        <div>
            <div className="flex items-center justify-between mb-3">
                <Label>Fee Categories *</Label>
                <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={handleSelectAllCategories}
                    className="text-xs"
                >
                    {categories && selectedCategories.length === categories.length 
                        ? 'Deselect All' 
                        : 'Select All'
                    }
                </Button>
            </div>
            <div className="space-y-2 border rounded-lg p-4 max-h-48 overflow-y-auto">
                {categories && categories.length > 0 ? (
                    categories.map((category) => (
                        <div key={category.id} className="flex items-center space-x-2">
                            <Checkbox
                                id={`cat-${category.id}`}
                                checked={selectedCategories.includes(category.id)}
                                onCheckedChange={() => handleCategoryToggle(category.id)}
                            />
                            <label
                                htmlFor={`cat-${category.id}`}
                                className="text-sm font-medium leading-none cursor-pointer"
                            >
                                {category.name} <span className="text-muted-foreground">({category.code})</span>
                            </label>
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground">
                        No fee categories found. Please create fee categories first.
                    </p>
                )}
            </div>
        </div>
    )

    // Month/Year Selector Component (reusable)
    const MonthYearSelector = () => (
        <div className="grid grid-cols-2 gap-4">
            <div>
                <Label>Month *</Label>
                <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1">January</SelectItem>
                        <SelectItem value="2">February</SelectItem>
                        <SelectItem value="3">March</SelectItem>
                        <SelectItem value="4">April</SelectItem>
                        <SelectItem value="5">May</SelectItem>
                        <SelectItem value="6">June</SelectItem>
                        <SelectItem value="7">July</SelectItem>
                        <SelectItem value="8">August</SelectItem>
                        <SelectItem value="9">September</SelectItem>
                        <SelectItem value="10">October</SelectItem>
                        <SelectItem value="11">November</SelectItem>
                        <SelectItem value="12">December</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div>
                <Label>Year *</Label>
                <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="2024">2024</SelectItem>
                        <SelectItem value="2025">2025</SelectItem>
                        <SelectItem value="2026">2026</SelectItem>
                        <SelectItem value="2027">2027</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    )

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/fees"><IconArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Generate Fees</h1>
                    <p className="text-muted-foreground">Generate fee records for students</p>
                </div>
            </div>

            <Tabs defaultValue="bulk" className="max-w-2xl">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="bulk" className="flex items-center gap-2">
                        <IconUsers className="h-4 w-4" />
                        Bulk Generation
                    </TabsTrigger>
                    <TabsTrigger value="individual" className="flex items-center gap-2">
                        <IconUser className="h-4 w-4" />
                        Individual Student
                    </TabsTrigger>
                </TabsList>

                {/* Bulk Generation Tab */}
                <TabsContent value="bulk">
                    <Card>
                        <CardHeader>
                            <CardTitle>Bulk Fee Generation</CardTitle>
                            <CardDescription>Generate fees for multiple students at once based on grade level or section</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <MonthYearSelector />

                            <div>
                                <Label>Grade Level</Label>
                                <Select value={gradeLevel} onValueChange={(v) => { setGradeLevel(v); setSection('all') }}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Grades</SelectItem>
                                        {gradeLevels?.map((grade) => (
                                            <SelectItem key={grade.id} value={grade.id}>{grade.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Select a specific grade or generate for all grades
                                </p>
                            </div>

                            {gradeLevel !== 'all' && sections && sections.length > 0 && (
                                <div>
                                    <Label>Section</Label>
                                    <Select value={section} onValueChange={setSection}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Sections</SelectItem>
                                            {sections.map((sec) => (
                                                <SelectItem key={sec.id} value={sec.id}>{sec.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <FeeCategoriesSelector />

                            <div className="pt-4 border-t">
                                <Button
                                    onClick={handleBulkGenerate}
                                    disabled={generating || selectedCategories.length === 0}
                                    className="w-full"
                                    size="lg"
                                >
                                    {generating ? (
                                        <>
                                            <IconLoader2 className="mr-2 h-5 w-5 animate-spin" />
                                            Generating fees...
                                        </>
                                    ) : (
                                        <>
                                            <IconFileInvoice className="mr-2 h-5 w-5" />
                                            Generate Fees for All Students
                                        </>
                                    )}
                                </Button>
                                <p className="text-xs text-center text-muted-foreground mt-2">
                                    This will create fee records for all students matching your criteria
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Individual Student Tab */}
                <TabsContent value="individual">
                    <Card>
                        <CardHeader>
                            <CardTitle>Individual Student Fee</CardTitle>
                            <CardDescription>Generate a fee record for a specific student</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Student Search */}
                            <div>
                                <Label>Select Student *</Label>
                                {selectedStudent ? (
                                    <div className="flex items-center justify-between p-3 border rounded-lg bg-green-50 border-green-200">
                                        <div>
                                            <p className="font-medium">
                                                {selectedStudent.profile?.first_name} {selectedStudent.profile?.last_name}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                ID: {selectedStudent.student_number} • {selectedStudent.grade_levels?.name || selectedStudent.grade_level || 'No Grade'}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setSelectedStudent(null)}
                                        >
                                            Change
                                        </Button>
                                    </div>
                                ) : (
                                    <Combobox
                                        options={studentOptions}
                                        value={selectedStudent?.id || ''}
                                        onValueChange={handleStudentSelect}
                                        onSearchChange={setStudentSearch}
                                        placeholder="Search by name or student number..."
                                        searchPlaceholder="Type to search students..."
                                        emptyMessage={searchLoading ? "Searching..." : studentSearch.length < 2 ? "Type at least 2 characters" : "No students found"}
                                    />
                                )}
                            </div>

                            <MonthYearSelector />

                            <div>
                                <Label>Due Date</Label>
                                <Input
                                    type="date"
                                    value={dueDate || defaultDueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Default is the 10th of the selected month
                                </p>
                            </div>

                            <FeeCategoriesSelector />

                            <div className="pt-4 border-t">
                                <Button
                                    onClick={handleIndividualGenerate}
                                    disabled={generating || !selectedStudent || selectedCategories.length === 0}
                                    className="w-full"
                                    size="lg"
                                >
                                    {generating ? (
                                        <>
                                            <IconLoader2 className="mr-2 h-5 w-5 animate-spin" />
                                            Generating fee...
                                        </>
                                    ) : (
                                        <>
                                            <IconFileInvoice className="mr-2 h-5 w-5" />
                                            Generate Fee for Student
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Card className="max-w-2xl bg-blue-50 border-blue-200">
                <CardHeader>
                    <CardTitle className="text-blue-900">💡 How It Works</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-blue-900 space-y-2">
                    <p>• Fees are generated based on fee structures configured in Settings</p>
                    <p>• Sibling discounts are automatically applied if enabled</p>
                    <p>• If a fee already exists for a student for that month, it will be skipped</p>
                    <p>• Use <strong>Bulk Generation</strong> for monthly fee processing</p>
                    <p>• Use <strong>Individual Student</strong> for late admissions or special cases</p>
                </CardContent>
            </Card>

            <div className="max-w-2xl">
                <Button variant="outline" asChild>
                    <Link href="/admin/fees/structures">
                        Manage Fee Structures →
                    </Link>
                </Button>
            </div>
        </div>
    )
}
