'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { IconArrowLeft, IconFileInvoice, IconLoader2 } from '@tabler/icons-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'

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

export default function GenerateFeesPage() {
    const { profile } = useAuth()
    const { selectedCampus } = useCampus()
    const schoolId = selectedCampus?.id || profile?.school_id || ''

    const currentDate = new Date()
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    
    const [month, setMonth] = useState(nextMonth.getMonth() + 1) // 1-12
    const [year, setYear] = useState(nextMonth.getFullYear())
    const [gradeLevel, setGradeLevel] = useState('all')
    const [section, setSection] = useState('all')
    const [selectedCategories, setSelectedCategories] = useState<string[]>([])
    const [generating, setGenerating] = useState(false)

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
            setSelectedCategories([]) // Deselect all
        } else {
            setSelectedCategories(allCategoryIds) // Select all
        }
    }

    const handleGenerate = async () => {
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
            
            // When all categories are selected, send null to indicate "select all"
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
                    // Send null when all categories are selected for proper "select all" behavior
                    category_ids: isAllCategoriesSelected ? null : selectedCategories
                })
            })

            const result = await response.json()

            if (result.success) {
                const message = isAllCategoriesSelected 
                    ? `Successfully generated ${result.data?.feesCreated || 0} comprehensive fee records (all categories) for ${result.data?.studentsProcessed || 0} students`
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

            <Card className="max-w-2xl">
                <CardHeader>
                    <CardTitle>Generate Student Fees</CardTitle>
                    <CardDescription>Create fee records based on fee structures</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
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
                        <div className="space-y-2 border rounded-lg p-4">
                            {categories && categories.length > 0 ? (
                                categories.map((category) => (
                                    <div key={category.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={category.id}
                                            checked={selectedCategories.includes(category.id)}
                                            onCheckedChange={() => handleCategoryToggle(category.id)}
                                        />
                                        <label
                                            htmlFor={category.id}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
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
                        <p className="text-xs text-muted-foreground mt-1">
                            Select specific categories for individual challans, or select all for one comprehensive challan
                        </p>
                    </div>

                    <div className="pt-4 border-t">
                        <Button
                            onClick={handleGenerate}
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
                                    Generate Fees
                                </>
                            )}
                        </Button>
                        <p className="text-xs text-center text-muted-foreground mt-2">
                            This will create fee records for all students matching your criteria
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card className="max-w-2xl bg-blue-50 border-blue-200">
                <CardHeader>
                    <CardTitle className="text-blue-900">💡 How It Works</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-blue-900 space-y-2">
                    <p>• Fees are generated based on fee structures configured in Settings</p>
                    <p>• Sibling discounts are automatically applied if enabled</p>
                    <p>• If a fee already exists for a student, it will be skipped</p>
                    <p>• You can generate fees monthly or for specific periods</p>
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
