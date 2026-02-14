'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { IconArrowLeft, IconPlus, IconTrash, IconEdit, IconDeviceFloppy } from '@tabler/icons-react'
import { toast } from 'sonner'
import Link from 'next/link'
import useSWR from 'swr'

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
    amount: number
    due_date: string
    grade_level?: { name: string }
    fee_category?: { name: string }
}

export default function FeeStructuresPage() {
    const { profile } = useAuth()
    const { selectedCampus } = useCampus()
    const schoolId = selectedCampus?.id || profile?.school_id || ''

    const [academicYear, setAcademicYear] = useState('2025-2026')
    const [editingStructure, setEditingStructure] = useState<FeeStructure | null>(null)
    const [isAddingNew, setIsAddingNew] = useState(false)

    // Form state
    const [formData, setFormData] = useState({
        grade_level_id: '',
        fee_category_id: '',
        period_type: 'monthly',
        amount: '',
        due_date: ''
    })

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

    // Fetch fee structures
    const { data: structures, mutate: mutateStructures, isLoading } = useSWR<FeeStructure[]>(
        schoolId ? `fee-structures-${schoolId}-${academicYear}` : null,
        async () => {
            const { createClient } = await import('@/lib/supabase/client')
            const token = (await createClient().auth.getSession()).data.session?.access_token
            const res = await fetch(`${API_BASE}/api/fees/structures?school_id=${schoolId}&academic_year=${academicYear}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const json = await res.json()
            return json.success ? json.data : []
        }
    )

    const handleSave = async () => {
        if (!formData.grade_level_id || !formData.fee_category_id || !formData.amount || !formData.due_date) {
            toast.error('Please fill all required fields')
            return
        }

        try {
            const { createClient } = await import('@/lib/supabase/client')
            const token = (await createClient().auth.getSession()).data.session?.access_token
            
            const url = editingStructure
                ? `${API_BASE}/api/fees/structures/${editingStructure.id}`
                : `${API_BASE}/api/fees/structures`

            const method = editingStructure ? 'PUT' : 'POST'

            const response = await fetch(url, {
                method,
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    school_id: schoolId,
                    academic_year: academicYear,
                    ...formData,
                    amount: parseFloat(formData.amount)
                })
            })

            const result = await response.json()

            if (result.success) {
                toast.success(editingStructure ? 'Updated successfully' : 'Created successfully')
                mutateStructures()
                resetForm()
            } else {
                toast.error(result.error || 'Operation failed')
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to save')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this fee structure?')) return

        try {
            const { createClient } = await import('@/lib/supabase/client')
            const token = (await createClient().auth.getSession()).data.session?.access_token
            
            const response = await fetch(`${API_BASE}/api/fees/structures/${id}?school_id=${schoolId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })

            const result = await response.json()

            if (result.success) {
                toast.success('Deleted successfully')
                mutateStructures()
            } else {
                toast.error(result.error || 'Delete failed')
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete')
        }
    }

    const handleEdit = (structure: FeeStructure) => {
        setEditingStructure(structure)
        setFormData({
            grade_level_id: structure.grade_level_id,
            fee_category_id: structure.fee_category_id,
            period_type: structure.period_type,
            amount: structure.amount.toString(),
            due_date: structure.due_date.split('T')[0]
        })
        setIsAddingNew(true)
    }

    const resetForm = () => {
        setEditingStructure(null)
        setIsAddingNew(false)
        setFormData({
            grade_level_id: '',
            fee_category_id: '',
            period_type: 'monthly',
            amount: '',
            due_date: ''
        })
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
                    <h1 className="text-2xl font-bold">Fee Structures</h1>
                    <p className="text-muted-foreground">Define fee amounts per grade and category</p>
                </div>
                <Button onClick={() => setIsAddingNew(true)}>
                    <IconPlus className="h-4 w-4 mr-2" />
                    Add New Structure
                </Button>
            </div>

            {/* Academic Year Filter */}
            <Card>
                <CardHeader>
                    <CardTitle>Academic Year</CardTitle>
                </CardHeader>
                <CardContent>
                    <Select value={academicYear} onValueChange={setAcademicYear}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="2024-2025">2024-2025</SelectItem>
                            <SelectItem value="2025-2026">2025-2026</SelectItem>
                            <SelectItem value="2026-2027">2026-2027</SelectItem>
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {/* Add/Edit Form */}
            {isAddingNew && (
                <Card>
                    <CardHeader>
                        <CardTitle>{editingStructure ? 'Edit' : 'Add'} Fee Structure</CardTitle>
                        <CardDescription>Set fee amount for a specific grade and category</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Grade Level *</Label>
                                <Select
                                    value={formData.grade_level_id}
                                    onValueChange={(v) => setFormData({ ...formData, grade_level_id: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select grade" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {gradeLevels?.map((grade) => (
                                            <SelectItem key={grade.id} value={grade.id}>{grade.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Fee Category *</Label>
                                <Select
                                    value={formData.fee_category_id}
                                    onValueChange={(v) => setFormData({ ...formData, fee_category_id: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories?.map((cat) => (
                                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Period Type *</Label>
                                <Select
                                    value={formData.period_type}
                                    onValueChange={(v) => setFormData({ ...formData, period_type: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="monthly">Monthly</SelectItem>
                                        <SelectItem value="semester">Semester</SelectItem>
                                        <SelectItem value="annual">Annual</SelectItem>
                                        <SelectItem value="one_time">One Time</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Amount *</Label>
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
                                <Label>Due Date *</Label>
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
                                {editingStructure ? 'Update' : 'Save'}
                            </Button>
                            <Button variant="outline" onClick={resetForm}>
                                Cancel
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Fee Structures Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Current Fee Structures</CardTitle>
                    <CardDescription>
                        {structures?.length || 0} structures defined for {academicYear}
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
                                        <TableHead>Grade</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Period</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Due Date</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {structures && structures.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                No fee structures defined. Click "Add New Structure" to create one.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        structures?.map((structure) => (
                                            <TableRow key={structure.id}>
                                                <TableCell className="font-medium">
                                                    {structure.grade_level?.name || 'N/A'}
                                                </TableCell>
                                                <TableCell>{structure.fee_category?.name || 'N/A'}</TableCell>
                                                <TableCell className="capitalize">{structure.period_type}</TableCell>
                                                <TableCell>{formatCurrency(structure.amount)}</TableCell>
                                                <TableCell>{new Date(structure.due_date).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-right">
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
