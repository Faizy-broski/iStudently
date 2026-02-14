'use client'

import { useState, useEffect } from 'react'
import { useCampus } from '@/context/CampusContext'
import * as accountingApi from '@/lib/api/accounting'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { IconArrowLeft, IconPlus, IconPencil, IconTrash, IconLoader } from '@tabler/icons-react'
import { toast } from 'sonner'
import Link from 'next/link'
import useSWR from 'swr'

export default function AccountingCategoriesPage() {
    const { selectedCampus, loading: campusLoading } = useCampus() || {}
    const campusId = selectedCampus?.id

    // Fetch categories
    const { data: categories, mutate, isLoading } = useSWR(
        campusId ? ['accounting-categories', campusId] : null,
        () => accountingApi.getCategories(campusId!, undefined, false), // Include inactive
        { revalidateOnFocus: false }
    )

    // Form states
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingCategory, setEditingCategory] = useState<accountingApi.AccountingCategory | null>(null)
    const [formName, setFormName] = useState('')
    const [formType, setFormType] = useState<accountingApi.CategoryType>('common')
    const [formDescription, setFormDescription] = useState('')
    const [formOrder, setFormOrder] = useState(0)
    const [saving, setSaving] = useState(false)

    // Reset form when dialog closes
    useEffect(() => {
        if (!dialogOpen) {
            setEditingCategory(null)
            setFormName('')
            setFormType('common')
            setFormDescription('')
            setFormOrder(0)
        }
    }, [dialogOpen])

    // Populate form when editing
    useEffect(() => {
        if (editingCategory) {
            setFormName(editingCategory.name)
            setFormType(editingCategory.category_type)
            setFormDescription(editingCategory.description || '')
            setFormOrder(editingCategory.display_order)
        }
    }, [editingCategory])

    const handleSave = async () => {
        if (!campusId || !formName.trim()) {
            toast.error('Category name is required')
            return
        }

        setSaving(true)
        try {
            if (editingCategory) {
                await accountingApi.updateCategory(editingCategory.id, {
                    campus_id: campusId,
                    name: formName.trim(),
                    category_type: formType,
                    description: formDescription.trim() || undefined,
                    display_order: formOrder
                })
                toast.success('Category updated')
            } else {
                await accountingApi.createCategory({
                    campus_id: campusId,
                    name: formName.trim(),
                    category_type: formType,
                    description: formDescription.trim() || undefined,
                    display_order: formOrder
                })
                toast.success('Category created')
            }
            mutate()
            setDialogOpen(false)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'An error occurred')
        } finally {
            setSaving(false)
        }
    }

    const handleToggleActive = async (category: accountingApi.AccountingCategory) => {
        if (!campusId) return
        try {
            await accountingApi.updateCategory(category.id, {
                campus_id: campusId,
                is_active: !category.is_active
            })
            toast.success(category.is_active ? 'Category deactivated' : 'Category activated')
            mutate()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'An error occurred')
        }
    }

    const handleDelete = async (category: accountingApi.AccountingCategory) => {
        if (!campusId) return
        try {
            await accountingApi.deleteCategory(category.id, campusId)
            toast.success('Category deleted')
            mutate()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'An error occurred')
        }
    }

    const getCategoryTypeBadge = (type: accountingApi.CategoryType) => {
        switch (type) {
            case 'incomes':
                return <Badge variant="default" className="bg-green-500">Incomes</Badge>
            case 'expenses':
                return <Badge variant="default" className="bg-red-500">Expenses</Badge>
            case 'common':
                return <Badge variant="secondary">Both</Badge>
        }
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
                        <p className="text-muted-foreground text-center">Please select a campus to manage accounting categories.</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/accounting/incomes"><IconArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold tracking-tight">Accounting Categories</h1>
                    <p className="text-muted-foreground">
                        Manage categories for incomes and expenses • {selectedCampus.name}
                    </p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <IconPlus className="h-4 w-4 mr-2" />
                            Add Category
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingCategory ? 'Edit Category' : 'New Category'}</DialogTitle>
                            <DialogDescription>
                                {editingCategory 
                                    ? 'Update the category details below.'
                                    : 'Create a new category for tracking incomes or expenses.'}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="e.g., Utilities, Tuition Fees"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="type">Category Type</Label>
                                <Select value={formType} onValueChange={(v) => setFormType(v as accountingApi.CategoryType)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="incomes">Incomes Only</SelectItem>
                                        <SelectItem value="expenses">Expenses Only</SelectItem>
                                        <SelectItem value="common">Both (Common)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    &quot;Both&quot; categories appear in both income and expense dropdowns
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description (Optional)</Label>
                                <Input
                                    id="description"
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    placeholder="Brief description of this category"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="order">Display Order</Label>
                                <Input
                                    id="order"
                                    type="number"
                                    value={formOrder}
                                    onChange={(e) => setFormOrder(parseInt(e.target.value) || 0)}
                                    placeholder="0"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Lower numbers appear first in dropdowns
                                </p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
                                {saving && <IconLoader className="h-4 w-4 mr-2 animate-spin" />}
                                {editingCategory ? 'Update' : 'Create'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Categories Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Categories</CardTitle>
                    <CardDescription>
                        Categories are used to organize and filter your incomes and expenses
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : !categories?.length ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No categories found. Create your first category to get started.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Order</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {categories.map((category) => (
                                    <TableRow key={category.id} className={!category.is_active ? 'opacity-50' : ''}>
                                        <TableCell className="font-mono text-sm">{category.display_order}</TableCell>
                                        <TableCell className="font-medium">{category.name}</TableCell>
                                        <TableCell>{getCategoryTypeBadge(category.category_type)}</TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {category.description || '-'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={category.is_active ? 'default' : 'outline'}>
                                                {category.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        setEditingCategory(category)
                                                        setDialogOpen(true)
                                                    }}
                                                >
                                                    <IconPencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleToggleActive(category)}
                                                >
                                                    {category.is_active ? 'Deactivate' : 'Activate'}
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="text-destructive">
                                                            <IconTrash className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Delete Category</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Are you sure you want to delete &quot;{category.name}&quot;? 
                                                                This will remove the category from all existing incomes and expenses.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => handleDelete(category)}
                                                                className="bg-destructive text-destructive-foreground"
                                                            >
                                                                Delete
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
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
