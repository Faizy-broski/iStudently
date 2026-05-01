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
            toast.error('اسم الفئة مطلوب')
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
                toast.success('تم تحديث الفئة')
            } else {
                await accountingApi.createCategory({
                    campus_id: campusId,
                    name: formName.trim(),
                    category_type: formType,
                    description: formDescription.trim() || undefined,
                    display_order: formOrder
                })
                toast.success('تم إنشاء الفئة')
            }
            mutate()
            setDialogOpen(false)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'حدث خطأ')
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
            toast.success(category.is_active ? 'تم تعطيل الفئة' : 'تم تفعيل الفئة')
            mutate()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'حدث خطأ')
        }
    }

    const handleDelete = async (category: accountingApi.AccountingCategory) => {
        if (!campusId) return
        try {
            await accountingApi.deleteCategory(category.id, campusId)
            toast.success('تم حذف الفئة')
            mutate()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'حدث خطأ')
        }
    }

    const getCategoryTypeBadge = (type: accountingApi.CategoryType) => {
        switch (type) {
            case 'incomes':
                return <Badge variant="default" className="bg-green-500">إيرادات</Badge>
            case 'expenses':
                return <Badge variant="default" className="bg-red-500">مصروفات</Badge>
            case 'common':
                return <Badge variant="secondary">كلاهما</Badge>
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
                        <p className="text-muted-foreground text-center">يرجى اختيار فرع لإدارة فئات المحاسبة.</p>
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
                    <h1 className="text-3xl font-bold tracking-tight">فئات المحاسبة</h1>
                    <p className="text-muted-foreground">
                        إدارة فئات الإيرادات والمصروفات • {selectedCampus.name}
                    </p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <IconPlus className="h-4 w-4 mr-2" />
                            إضافة فئة
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingCategory ? 'تعديل الفئة' : 'فئة جديدة'}</DialogTitle>
                            <DialogDescription>
                                {editingCategory 
                                    ? 'حدّث تفاصيل الفئة أدناه.'
                                    : 'أنشئ فئة جديدة لتتبع الإيرادات أو المصروفات.'}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">الاسم</Label>
                                <Input
                                    id="name"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="مثال: خدمات، رسوم دراسية"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="type">نوع الفئة</Label>
                                <Select value={formType} onValueChange={(v) => setFormType(v as accountingApi.CategoryType)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="incomes">إيرادات فقط</SelectItem>
                                        <SelectItem value="expenses">مصروفات فقط</SelectItem>
                                        <SelectItem value="common">كلاهما (مشتركة)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    تظهر الفئات &quot;المشتركة&quot; في قوائم الإيرادات والمصروفات
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">الوصف (اختياري)</Label>
                                <Input
                                    id="description"
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    placeholder="وصف مختصر لهذه الفئة"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="order">ترتيب العرض</Label>
                                <Input
                                    id="order"
                                    type="number"
                                    value={formOrder}
                                    onChange={(e) => setFormOrder(parseInt(e.target.value) || 0)}
                                    placeholder="0"
                                />
                                <p className="text-xs text-muted-foreground">
                                    الأرقام الأصغر تظهر أولاً في القوائم
                                </p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
                            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
                                {saving && <IconLoader className="h-4 w-4 mr-2 animate-spin" />}
                                {editingCategory ? 'تحديث' : 'إنشاء'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Categories Table */}
            <Card>
                <CardHeader>
                    <CardTitle>الفئات</CardTitle>
                    <CardDescription>
                        تُستخدم الفئات لتنظيم وتصفية الإيرادات والمصروفات
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : !categories?.length ? (
                        <div className="text-center py-8 text-muted-foreground">
                            لم يتم العثور على فئات. أنشئ أول فئة للبدء.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>الترتيب</TableHead>
                                    <TableHead>الاسم</TableHead>
                                    <TableHead>النوع</TableHead>
                                    <TableHead>الوصف</TableHead>
                                    <TableHead>الحالة</TableHead>
                                    <TableHead className="text-right">الإجراءات</TableHead>
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
                                                {category.is_active ? 'نشط' : 'غير نشط'}
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
                                                    {category.is_active ? 'تعطيل' : 'تفعيل'}
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="text-destructive">
                                                            <IconTrash className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>حذف الفئة</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                هل أنت متأكد من حذف &quot;{category.name}&quot;؟
                                                                سيؤدي ذلك إلى إزالة الفئة من جميع الإيرادات والمصروفات الحالية.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => handleDelete(category)}
                                                                className="bg-destructive text-destructive-foreground"
                                                            >
                                                                حذف
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
