'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, BookOpen } from 'lucide-react'
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

export default function SubjectsPage() {
  const t = useTranslations('school.subjects')
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus
  
  const [subjects, setSubjects] = useState<academicsApi.Subject[]>([])
  const [grades, setGrades] = useState<academicsApi.GradeLevel[]>([])
  const [filterGrade, setFilterGrade] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<academicsApi.Subject | null>(null)
  const [subjectToDelete, setSubjectToDelete] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    grade_level_id: '',
    name: '',
    code: '',
    subject_type: 'theory' as academicsApi.SubjectType,
  })

  useEffect(() => {
    if (selectedCampus) {
      fetchGrades()
      fetchSubjects()
    }
  }, [selectedCampus])

  useEffect(() => {
    if (selectedCampus) {
      fetchSubjects()
    }
  }, [filterGrade, selectedCampus])

  const fetchGrades = async () => {
    if (!selectedCampus) return
    const result = await academicsApi.getGradeLevels(selectedCampus.id)
    if (result.success && result.data) {
      setGrades(
        result.data
          .filter((g) => g.is_active)
          .sort((a, b) => {
            const numA = parseInt(a.name.replace(/\D/g, ''), 10)
            const numB = parseInt(b.name.replace(/\D/g, ''), 10)
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB
            return a.name.localeCompare(b.name)
          })
      )
    }
  }

  const fetchSubjects = async () => {
    if (!selectedCampus) return
    setLoading(true)
    const gradeFilter = filterGrade && filterGrade !== 'all' ? filterGrade : undefined
    const result = await academicsApi.getSubjects(gradeFilter, selectedCampus.id)
    if (result.success && result.data) {
      setSubjects(result.data)
    } else {
      toast.error(result.error || t('fetch_error'))
    }
    setLoading(false)
  }

  const handleOpenDialog = (subject?: academicsApi.Subject) => {
    if (subject) {
      setEditingSubject(subject)
      setFormData({
        grade_level_id: subject.grade_level_id,
        name: subject.name,
        code: subject.code,
        subject_type: subject.subject_type,
      })
    } else {
      setEditingSubject(null)
      setFormData({
        grade_level_id: '',
        name: '',
        code: '',
        subject_type: 'theory',
      })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingSubject(null)
    setFormData({
      grade_level_id: '',
      name: '',
      code: '',
      subject_type: 'theory',
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

    if (!formData.code.trim()) {
      toast.error(t('code_required'))
      return
    }

    setSaving(true)
    try {
      // Include campus_id for new subjects
      const submitData = editingSubject
        ? { name: formData.name, code: formData.code, subject_type: formData.subject_type }
        : { ...formData, campus_id: selectedCampus?.id }

      const result = editingSubject
        ? await academicsApi.updateSubject(editingSubject.id, submitData)
        : await academicsApi.createSubject(submitData)

      if (result.success) {
        toast.success(t(editingSubject ? 'update_success' : 'create_success'))
        handleCloseDialog()
        fetchSubjects()
      } else {
        toast.error(result.error || t(editingSubject ? 'fetch_error' : 'fetch_error'))
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = (subjectId: string) => {
    setSubjectToDelete(subjectId)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!subjectToDelete) return

    const result = await academicsApi.deleteSubject(subjectToDelete, selectedCampus?.id)

    if (result.success) {
      toast.success(t('delete_success'))
      fetchSubjects()
    } else {
      toast.error(result.error || t('fetch_error'))
    }

    setDeleteDialogOpen(false)
    setSubjectToDelete(null)
  }

  const getSubjectTypeVariant = (type: academicsApi.SubjectType) => {
    switch (type) {
      case 'theory':
        return 'default'
      case 'lab':
        return 'secondary'
      case 'practical':
        return 'outline'
      default:
        return 'default'
    }
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
          {t('add_subject')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('all_subjects')}</CardTitle>
              <CardDescription>{t('all_subjects_desc')}</CardDescription>
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
          ) : subjects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('no_subjects')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('code')}</TableHead>
                  <TableHead>{t('grade')}</TableHead>
                  <TableHead>{t('type')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{subject.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {subject.code}
                      </code>
                    </TableCell>
                    <TableCell>{subject.grade_name}</TableCell>
                    <TableCell>
                      <Badge variant={getSubjectTypeVariant(subject.subject_type)}>
                        {t(subject.subject_type as any)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={subject.is_active ? 'default' : 'secondary'}>
                        {subject.is_active ? t('active') : t('inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(subject)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(subject.id)}
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
            <DialogTitle>{editingSubject ? t('edit_title') : t('add_title')}</DialogTitle>
            <DialogDescription>
              {editingSubject ? t('edit_desc') : t('add_desc')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="grade_level_id">{t('grade_label')}</Label>
                <Select
                  value={formData.grade_level_id}
                  onValueChange={(value) => setFormData({ ...formData, grade_level_id: value })}
                  disabled={!!editingSubject}
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
                <p className="text-sm text-muted-foreground">
                  {t('grade_desc')}
                </p>
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
                <Label htmlFor="code">{t('code_label')}</Label>
                <Input
                  id="code"
                  placeholder={t('code_placeholder')}
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  {t('code_desc')}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject_type">{t('type_label')}</Label>
                <Select
                  value={formData.subject_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, subject_type: value as academicsApi.SubjectType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="theory">{t('theory')}</SelectItem>
                    <SelectItem value="lab">{t('lab')}</SelectItem>
                    <SelectItem value="practical">{t('practical')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog} disabled={saving}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t(editingSubject ? 'updating' : 'creating') : t(editingSubject ? 'update' : 'create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_confirm_desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSubjectToDelete(null)}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
