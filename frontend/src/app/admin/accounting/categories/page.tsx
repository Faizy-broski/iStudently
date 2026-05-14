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
import { useTranslations } from 'next-intl'

export default function AccountingCategoriesPage() {
    const t = useTranslations('admin.accounting.categories')
    const tCommon = useTranslations('common')
    const { selectedCampus, loading: campusLoading } = useCampus() || {}
    const campusId = selectedCampus?.id

    const { data: categories, mutate, isLoading } = useSWR(
        campusId ? ['accounting-categories', campusId] : null,
        () => accountingApi.getCategories(campusId!, undefined, false),
        { revalidateOnFocus: false }
    )

    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingCategory, setEditingCategory] = useState<accountingApi.AccountingCategory | null>(null)
    const [formName, setFormName] = useState('')
    const [formType, setFormType] = useState<accountingApi.CategoryType>('common')
    const [formDescription, setFormDescription] = useState('')
    const [formOrder, setFormOrder] = useState(0)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!dialogOpen) {
            setEditingCategory(null)
            setFormName('')
            setFormType('common')
            setFormDescription('')
            setFormOrder(0)
        }
    }, [dialogOpen])

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
            toast.error(t('toast.name_required'))
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
                toast.success(t('toast.updated'))
            } else {
                await accountingApi.createCategory({
                    campus_id: campusId,
                    name: formName.trim(),
                    category_type: formType,
                    description: formDescription.trim() || undefined,
                    display_order: formOrder
                })
                toast.success(t('toast.created'))
            }
            mutate()
            setDialogOpen(false)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : tCommon('error'))
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
            toast.success(category.is_active ? t('toast.disabled') : t('toast.enabled'))
            mutate()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : tCommon('error'))
        }
    }

    const handleDelete = async (category: accountingApi.AccountingCategory) => {
        if (!campusId) return
        try {
            await accountingApi.deleteCategory(category.id, campusId)
            toast.success(t('toast.deleted'))
            mutate()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : tCommon('error'))
        }
    }

    const getCategoryTypeBadge = (type: accountingApi.CategoryType) => {
        switch (type) {
            case 'incomes':
                return <Badge variant="default" className="bg-green-500">{t('type_incomes')}</Badge>
            case 'expenses':
                return <Badge variant="default" className="bg-red-500">{t('type_expenses')}</Badge>
            case 'common':
                return <Badge variant="secondary">{t('type_common')}</Badge>
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
                        <p className="text-muted-foreground text-center">{t('select_campus')}</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/accounting/incomes"><IconArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
                    <p className="text-muted-foreground">{t('subtitle', { campus: selectedCampus.name })}</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <IconPlus className="h-4 w-4 mr-2" />
                            {t('add_category')}
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingCategory ? t('dialog_edit_title') : t('dialog_new_title')}</DialogTitle>
                            <DialogDescription>
                                {editingCategory ? t('dialog_edit_desc') : t('dialog_new_desc')}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">{t('form_name')}</Label>
                                <Input
                                    id="name"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder={t('form_name_placeholder')}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="type">{t('form_type')}</Label>
                                <Select value={formType} onValueChange={(v) => setFormType(v as accountingApi.CategoryType)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="incomes">{t('form_type_incomes')}</SelectItem>
                                        <SelectItem value="expenses">{t('form_type_expenses')}</SelectItem>
                                        <SelectItem value="common">{t('form_type_common')}</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">{t('form_type_hint')}</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">{t('form_desc')}</Label>
                                <Input
                                    id="description"
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    placeholder={t('form_desc_placeholder')}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="order">{t('form_order')}</Label>
                                <Input
                                    id="order"
                                    type="number"
                                    value={formOrder}
                                    onChange={(e) => setFormOrder(parseInt(e.target.value) || 0)}
                                    placeholder="0"
                                />
                                <p className="text-xs text-muted-foreground">{t('form_order_hint')}</p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>{tCommon('cancel')}</Button>
                            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
                                {saving && <IconLoader className="h-4 w-4 mr-2 animate-spin" />}
                                {editingCategory ? tCommon('update') : tCommon('create')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('table_title')}</CardTitle>
                    <CardDescription>{t('table_desc')}</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <IconLoader className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : !categories?.length ? (
                        <div className="text-center py-8 text-muted-foreground">{t('empty')}</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('col_order')}</TableHead>
                                    <TableHead>{t('col_name')}</TableHead>
                                    <TableHead>{t('col_type')}</TableHead>
                                    <TableHead>{t('col_description')}</TableHead>
                                    <TableHead>{t('col_status')}</TableHead>
                                    <TableHead className="text-right">{tCommon('actions')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {categories.map((category) => (
                                    <TableRow key={category.id} className={!category.is_active ? 'opacity-50' : ''}>
                                        <TableCell className="font-mono text-sm">{category.display_order}</TableCell>
                                        <TableCell className="font-medium">{category.name}</TableCell>
                                        <TableCell>{getCategoryTypeBadge(category.category_type)}</TableCell>
                                        <TableCell className="text-muted-foreground">{category.description || '-'}</TableCell>
                                        <TableCell>
                                            <Badge variant={category.is_active ? 'default' : 'outline'}>
                                                {category.is_active ? tCommon('active') : tCommon('inactive')}
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
                                                    {category.is_active ? t('btn_disable') : t('btn_enable')}
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="text-destructive">
                                                            <IconTrash className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>{t('delete_title')}</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                {t('delete_confirm', { name: category.name })}
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => handleDelete(category)}
                                                                className="bg-destructive text-destructive-foreground"
                                                            >
                                                                {tCommon('delete')}
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
