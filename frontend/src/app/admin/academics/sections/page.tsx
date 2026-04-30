'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

export default function SectionsPage() {
  const t = useTranslations('school.sections')
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus
  
  const [sections, setSections] = useState<academicsApi.Section[]>([])
  const [grades, setGrades] = useState<academicsApi.GradeLevel[]>([])
  const [filterGrade, setFilterGrade] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<academicsApi.Section | null>(null)
  const [sectionToDelete, setSectionToDelete] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    grade_level_id: '',
    name: '',
    capacity: 30,
  })

  useEffect(() => {
    if (selectedCampus) {
      fetchGrades()
      fetchSections()
    }
  }, [selectedCampus])

  useEffect(() => {
    if (selectedCampus) {
      fetchSections()
    }
  }, [filterGrade, selectedCampus])

  const fetchGrades = async () => {
    if (!selectedCampus) return
    const result = await academicsApi.getGradeLevels(selectedCampus.id)
    if (result.success && result.data) {
      setGrades(result.data.filter((g) => g.is_active))
    }
  }

  const fetchSections = async () => {
    if (!selectedCampus) return
    setLoading(true)
    const gradeFilter = filterGrade && filterGrade !== 'all' ? filterGrade : undefined
    const result = await academicsApi.getSections(gradeFilter, selectedCampus.id)
    if (result.success && result.data) {
      setSections(result.data)
    } else {
      toast.error(result.error || t('fetch_error'))
    }
    setLoading(false)
  }

  const handleOpenDialog = (section?: academicsApi.Section) => {
    if (section) {
      setEditingSection(section)
      setFormData({
        grade_level_id: section.grade_level_id,
        name: section.name,
        capacity: section.capacity,
      })
    } else {
      setEditingSection(null)
      setFormData({
        grade_level_id: '',
        name: '',
        capacity: 30,
      })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingSection(null)
    setFormData({
      grade_level_id: '',
      name: '',
      capacity: 30,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.grade_level_id) {
      toast.error(t('grade_required'))
      return
    }

    if (!formData.name.trim()) {
      toast.error(t('name_required'))
      return
    }

    if (formData.capacity < 1) {
      toast.error(t('capacity_min'))
      return
    }

    setSaving(true)
    try {
      // Include campus_id for new sections
      const submitData = editingSection
        ? { name: formData.name, capacity: formData.capacity }
        : { ...formData, campus_id: selectedCampus?.id }

      const result = editingSection
        ? await academicsApi.updateSection(editingSection.id, submitData)
        : await academicsApi.createSection(submitData)

      if (result.success) {
        toast.success(t(editingSection ? 'update_success' : 'create_success'))
        handleCloseDialog()
        fetchSections()
      } else {
        toast.error(result.error || t(editingSection ? 'fetch_error' : 'fetch_error'))
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = (sectionId: string) => {
    setSectionToDelete(sectionId)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!sectionToDelete) return

    const result = await academicsApi.deleteSection(sectionToDelete, selectedCampus?.id)

    if (result.success) {
      toast.success(t('delete_success'))
      fetchSections()
    } else {
      toast.error(result.error || t('fetch_error'))
    }

    setDeleteDialogOpen(false)
    setSectionToDelete(null)
  }

  const getCapacityColor = (section: academicsApi.Section) => {
    const utilization = (section.current_strength / section.capacity) * 100
    if (utilization >= 90) return 'text-destructive'
    if (utilization >= 75) return 'text-yellow-600'
    return 'text-green-600'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          {t('add_section')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('all_sections')}</CardTitle>
              <CardDescription>{t('all_sections_desc')}</CardDescription>
            </div>
            <div className="w-[200px]">
              <Select value={filterGrade} onValueChange={setFilterGrade}>
                <SelectTrigger>
                  <SelectValue placeholder={t('all_grades')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_grades')}</SelectItem>
                  {grades.map((grade) => (
                    <SelectItem key={grade.id} value={grade.id}>
                      {grade.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">{t('loading')}</div>
          ) : sections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('no_sections')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('grade')}</TableHead>
                  <TableHead>{t('capacity')}</TableHead>
                  <TableHead>{t('strength')}</TableHead>
                  <TableHead>{t('available')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.map((section) => (
                  <TableRow key={section.id}>
                    <TableCell className="font-medium">{section.name}</TableCell>
                    <TableCell>{section.grade_name}</TableCell>
                    <TableCell>{section.capacity}</TableCell>
                    <TableCell>
                      <span className={getCapacityColor(section)}>
                        {section.current_strength}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          section.available_seats === 0
                            ? 'destructive'
                            : section.available_seats! < 5
                            ? 'secondary'
                            : 'default'
                        }
                      >
                        {t('seats', { count: section.available_seats })}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={section.is_active ? 'default' : 'secondary'}>
                        {section.is_active ? t('active') : t('inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(section)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(section.id)}
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
            <DialogTitle>{editingSection ? t('edit_title') : t('add_title')}</DialogTitle>
            <DialogDescription>
              {editingSection ? t('edit_desc') : t('add_desc')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="grade_level_id">{t('grade_label')}</Label>
                <Select
                  value={formData.grade_level_id}
                  onValueChange={(value) => setFormData({ ...formData, grade_level_id: value })}
                  disabled={!!editingSection}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_grade')} />
                  </SelectTrigger>
                  <SelectContent>
                    {grades.map((grade) => (
                      <SelectItem key={grade.id} value={grade.id}>
                        {grade.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                <Label htmlFor="capacity">{t('capacity_label')}</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  placeholder="30"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  {t('capacity_desc')}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog} disabled={saving}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t(editingSection ? 'updating' : 'creating') : t(editingSection ? 'update' : 'create')}
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
            <AlertDialogCancel onClick={() => setSectionToDelete(null)}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
