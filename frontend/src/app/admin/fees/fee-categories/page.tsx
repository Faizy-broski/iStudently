'use client'

import { useState } from 'react'
import { useFeeCategories } from '@/hooks/useFees'
import { createFeeCategory, updateFeeCategory, deleteFeeCategory } from '@/lib/api/fees'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { IconArrowLeft, IconPlus, IconEdit, IconDeviceFloppy, IconX, IconFolderOpen, IconTrash } from '@tabler/icons-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'

interface FeeCategory {
    id: string
    name: string
    code: string
    is_discountable: boolean
    is_active: boolean
}

export default function FeeCategoriesPage() {
    const { profile } = useAuth()
    const campusContext = useCampus()
    const selectedCampus = campusContext?.selectedCampus
    const schoolId = selectedCampus?.id || profile?.school_id || null

    const { data: categories, mutate: mutateCategories, isLoading } = useFeeCategories(schoolId)

    // New category form
    const [newCategoryName, setNewCategoryName] = useState('')
    const [newCategoryCode, setNewCategoryCode] = useState('')
    const [newCategoryDiscountable, setNewCategoryDiscountable] = useState(true)
    const [adding, setAdding] = useState(false)

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    const [editCode, setEditCode] = useState('')
    const [editDiscountable, setEditDiscountable] = useState(true)
    const [editActive, setEditActive] = useState(true)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)

    const handleAddCategory = async () => {
        if (!schoolId || !newCategoryName || !newCategoryCode) {
            toast.error('Please fill in all fields')
            return
        }
        setAdding(true)
        try {
            await createFeeCategory({
                school_id: schoolId,
                name: newCategoryName,
                code: newCategoryCode.toUpperCase(),
                is_discountable: newCategoryDiscountable
            })
            mutateCategories()
            setNewCategoryName('')
            setNewCategoryCode('')
            setNewCategoryDiscountable(true)
            toast.success('Category added successfully')
        } catch (error: any) {
            toast.error(error.message)
        }
        setAdding(false)
    }

    const startEdit = (cat: FeeCategory) => {
        setEditingId(cat.id)
        setEditName(cat.name)
        setEditCode(cat.code)
        setEditDiscountable(cat.is_discountable)
        setEditActive(cat.is_active)
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditName('')
        setEditCode('')
        setEditDiscountable(true)
        setEditActive(true)
    }

    const handleSaveEdit = async () => {
        if (!editingId || !editName || !editCode || !schoolId) {
            toast.error('Please fill in all fields')
            return
        }
        setSaving(true)
        try {
            await updateFeeCategory(editingId, {
                school_id: schoolId,
                name: editName,
                code: editCode.toUpperCase(),
                is_discountable: editDiscountable,
                is_active: editActive
            })
            mutateCategories()
            cancelEdit()
            toast.success('Category updated successfully')
        } catch (error: any) {
            toast.error(error.message)
        }
        setSaving(false)
    }

    const handleDelete = async (categoryId: string) => {
        if (!schoolId) return
        if (!confirm('Are you sure you want to delete this category? This cannot be undone.')) {
            return
        }
        setDeleting(categoryId)
        try {
            await deleteFeeCategory(categoryId, schoolId)
            mutateCategories()
            toast.success('Category deleted successfully')
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete category')
        }
        setDeleting(null)
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/fees"><IconArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div className="flex items-center gap-3 flex-1">
                    <IconFolderOpen className="h-8 w-8 text-[#3d8fb5]" />
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Fee Categories</h1>
                        <p className="text-muted-foreground">Manage fee types (tuition, bus, books, etc.)</p>
                    </div>
                </div>
            </div>

            {/* Add New Category */}
            <Card>
                <CardHeader>
                    <CardTitle>Add New Category</CardTitle>
                    <CardDescription>Create a new fee category for your school</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <Label>Category Name</Label>
                            <Input 
                                placeholder="e.g., Tuition Fee" 
                                value={newCategoryName} 
                                onChange={(e) => setNewCategoryName(e.target.value)} 
                            />
                        </div>
                        <div className="w-32">
                            <Label>Code</Label>
                            <Input 
                                placeholder="e.g., TUI" 
                                value={newCategoryCode} 
                                onChange={(e) => setNewCategoryCode(e.target.value.toUpperCase())} 
                            />
                        </div>
                        <div className="flex items-center gap-2 pb-2">
                            <Switch 
                                checked={newCategoryDiscountable} 
                                onCheckedChange={setNewCategoryDiscountable} 
                            />
                            <Label className="text-sm">Discountable</Label>
                        </div>
                        <Button onClick={handleAddCategory} disabled={adding}>
                            <IconPlus className="mr-2 h-4 w-4" />
                            {adding ? 'Adding...' : 'Add Category'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Categories List */}
            <Card>
                <CardHeader>
                    <CardTitle>Existing Categories</CardTitle>
                    <CardDescription>
                        {categories?.length || 0} categories configured
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading categories...</div>
                    ) : !categories || categories.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No fee categories found. Add your first category above.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-[#3d8fb5]">NAME</TableHead>
                                    <TableHead className="text-[#3d8fb5]">CODE</TableHead>
                                    <TableHead className="text-[#3d8fb5]">DISCOUNTABLE</TableHead>
                                    <TableHead className="text-[#3d8fb5]">STATUS</TableHead>
                                    <TableHead className="text-[#3d8fb5] text-right">ACTIONS</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {categories.map((cat) => (
                                    <TableRow key={cat.id}>
                                        {editingId === cat.id ? (
                                            <>
                                                <TableCell>
                                                    <Input 
                                                        value={editName} 
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        className="h-8"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input 
                                                        value={editCode} 
                                                        onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                                                        className="h-8 w-24"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Switch 
                                                        checked={editDiscountable} 
                                                        onCheckedChange={setEditDiscountable}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Switch 
                                                        checked={editActive} 
                                                        onCheckedChange={setEditActive}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button 
                                                            size="sm" 
                                                            onClick={handleSaveEdit}
                                                            disabled={saving}
                                                        >
                                                            <IconDeviceFloppy className="h-4 w-4" />
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant="outline"
                                                            onClick={cancelEdit}
                                                        >
                                                            <IconX className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </>
                                        ) : (
                                            <>
                                                <TableCell className="font-medium">{cat.name}</TableCell>
                                                <TableCell>
                                                    <span className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">
                                                        {cat.code}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                        cat.is_discountable 
                                                            ? 'bg-green-100 text-green-800' 
                                                            : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {cat.is_discountable ? 'Yes' : 'No'}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                        cat.is_active 
                                                            ? 'bg-green-100 text-green-800' 
                                                            : 'bg-red-100 text-red-800'
                                                    }`}>
                                                        {cat.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost"
                                                            onClick={() => startEdit(cat)}
                                                        >
                                                            <IconEdit className="h-4 w-4" />
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost"
                                                            onClick={() => handleDelete(cat.id)}
                                                            disabled={deleting === cat.id}
                                                            className="text-red-600 hover:text-red-700"
                                                        >
                                                            <IconTrash className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
