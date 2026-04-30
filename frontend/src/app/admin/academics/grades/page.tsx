'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, GraduationCap, Users, BookOpen, FolderDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import * as academicsApi from '@/lib/api/academics'
import { useCampus } from '@/context/CampusContext'

import { useTranslations } from 'next-intl'

export default function GradeLevelsPage() {
  const t = useTranslations('school.grades')
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus
  
  const [grades, setGrades] = useState<academicsApi.GradeLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingGrade, setEditingGrade] = useState<academicsApi.GradeLevel | null>(null)
  const [gradeToDelete, setGradeToDelete] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    order_index: 1,
    is_active: true,
    base_fee: 0
  })

  const fetchGrades = useCallback(async () => {
    if (!selectedCampus) return
    setLoading(true)
    const result = await academicsApi.getGradeLevels(selectedCampus.id)
    if (result.success && result.data) {
      setGrades([...result.data].sort((a, b) => a.order_index - b.order_index))
    } else {
      toast.error(result.error || t('fetch_error'))
    }
    setLoading(false)
  }, [selectedCampus, t])

  useEffect(() => {
    if (selectedCampus) {
      fetchGrades()
    }
  }, [selectedCampus, fetchGrades])

  // export grade levels to CSV
  const exportGrades = () => {
    if (grades.length === 0) return

    const headers = [
      t('order'),
      t('name'),
      t('sections'),
      t('subjects'),
      t('next_grade'),
      t('status')
    ]
    const rows = grades.map(g => {
      const nextName = g.next_grade_id
        ? grades.find(x => x.id === g.next_grade_id)?.name || ''
        : t('graduate')
      return [
        g.order_index.toString(),
        g.name,
        (g.sections_count || 0).toString(),
        (g.subjects_count || 0).toString(),
        nextName,
        g.is_active ? t('active') : t('inactive')
      ]
    })

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'grade_levels.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t('export_success'))
  }

  const handleOpenDialog = (grade?: academicsApi.GradeLevel) => {
    if (grade) {
      setEditingGrade(grade)
      setFormData({
        name: grade.name,
        order_index: grade.order_index,
        is_active: grade.is_active,
        base_fee: grade.base_fee || 0,
      })
    } else {
      setEditingGrade(null)
      setFormData({
        name: '',
        order_index: grades.length + 1,
        is_active: true,
        base_fee: 0,
      })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingGrade(null)
    setFormData({
      name: '',
      order_index: 1,
      is_active: true,
      base_fee: 0,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error(t('name_required'))
      return
    }

    setSaving(true)
    try {
      // Include campus_id when creating
      const submitData = editingGrade
        ? formData
        : { ...formData, campus_id: selectedCampus?.id }

      const result = editingGrade
        ? await academicsApi.updateGradeLevel(editingGrade.id, formData)
        : await academicsApi.createGradeLevel(submitData)

      if (result.success) {
        toast.success(t(editingGrade ? 'update_success' : 'create_success'))
        handleCloseDialog()
        fetchGrades()
      } else {
        toast.error(result.error || t(editingGrade ? 'fetch_error' : 'fetch_error'))
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = (gradeId: string) => {
    setGradeToDelete(gradeId)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!gradeToDelete) return

    const result = await academicsApi.deleteGradeLevel(gradeToDelete, selectedCampus?.id)

    if (result.success) {
      toast.success(t('delete_success'))
      fetchGrades()
    } else {
      toast.error(result.error || t('fetch_error'))
    }

    setDeleteDialogOpen(false)
    setGradeToDelete(null)
  }

  const handleNextGradeChange = async (gradeId: string, nextGradeId: string) => {
    // Optimistic update: update UI immediately
    const previousGrades = [...grades]
    setGrades((prev) =>
      prev.map((g) =>
        g.id === gradeId
          ? { ...g, next_grade_id: nextGradeId === 'graduate' ? null : nextGradeId }
          : g
      )
    )

    try {
      const result = await academicsApi.updateGradeLevel(gradeId, {
        next_grade_id: nextGradeId === 'graduate' ? null : nextGradeId,
      })

      if (result.success) {
        toast.success(t('next_grade_success'))
        fetchGrades()
      } else {
        // Rollback on error
        setGrades(previousGrades)
        toast.error(result.error || t('fetch_error'))
      }
    } catch {
      // Rollback on exception
      setGrades(previousGrades)
      toast.error(t('fetch_error'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-[#3d8fb5]" />
            <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          </div>
      
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          {t('add_grade')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('all_grades')}</CardTitle>
          <CardDescription>
            {t('all_grades_desc')}
          </CardDescription>
        </CardHeader>
        <div className="flex items-center gap-3 pl-6" >
        <p className="text-xl font-medium text-foreground">
          {grades.length === 1 ? t('found_singular') : t('found_plural', { count: grades.length })}
        </p>
        
        <div
          className="h-8 w-8 text-yellow-500 cursor-pointer hover:text-yellow-600"
          title={t('export_csv')}
          onClick={exportGrades}
        >
          <FolderDown />
        </div>
        
      </div>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">{t('loading')}</div>
          ) : grades.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('no_grades')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('order')}</TableHead>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>
                    <Users className="inline mr-1 h-4 w-4" />
                    {t('sections')}
                  </TableHead>
                  <TableHead>
                    <BookOpen className="inline mr-1 h-4 w-4" />
                    {t('subjects')}
                  </TableHead>
                  <TableHead>{t('next_grade')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grades.map((grade) => (
                  <TableRow key={grade.id}>
                    <TableCell className="font-medium">{grade.order_index}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        {grade.name}
                      </div>
                    </TableCell>
                    <TableCell>{grade.sections_count || 0}</TableCell>
                    <TableCell>{grade.subjects_count || 0}</TableCell>
                    <TableCell>
                      <Select
                        value={grade.next_grade_id || 'graduate'}
                        onValueChange={(value) => handleNextGradeChange(grade.id, value)}
                      >
                        <SelectTrigger className="w-45">
                          <SelectValue placeholder={t('select_next')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="graduate">{t('graduate')}</SelectItem>
                          {grades
                            .filter((g) => g.order_index > grade.order_index)
                            .map((nextGrade) => (
                              <SelectItem key={nextGrade.id} value={nextGrade.id}>
                                {nextGrade.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={grade.is_active ? 'default' : 'secondary'}>
                        {grade.is_active ? t('active') : t('inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(grade)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(grade.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGrade ? t('edit_title') : t('add_title')}</DialogTitle>
            <DialogDescription>
              {editingGrade ? t('edit_desc') : t('add_desc')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('name_label')}</Label>
                <Input
                  id="name"
                  placeholder={t('name_placeholder')}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="order_index">{t('order_label')}</Label>
                <Input
                  id="order_index"
                  type="number"
                  min="1"
                  placeholder={t('order_placeholder')}
                  value={formData.order_index || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })
                  }
                  required
                />
                <p className="text-sm text-muted-foreground">
                  {t('order_desc')}
                </p>
              </div>
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label htmlFor="is_active">{t('status_label')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('status_desc')}
                  </p>
                </div>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog} disabled={saving}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t(editingGrade ? 'updating' : 'creating') : t(editingGrade ? 'update' : 'create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_confirm_desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setGradeToDelete(null)}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
