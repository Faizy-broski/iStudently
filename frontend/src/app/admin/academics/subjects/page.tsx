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

export default function SubjectsPage() {
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus
  
  const [subjects, setSubjects] = useState<academicsApi.Subject[]>([])
  const [grades, setGrades] = useState<academicsApi.GradeLevel[]>([])
  const [filterGrade, setFilterGrade] = useState<string>('')
  const [loading, setLoading] = useState(true)
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
      setGrades(result.data.filter((g) => g.is_active))
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
      toast.error(result.error || 'Failed to fetch subjects')
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
      toast.error('Please select a grade level')
      return
    }

    if (!formData.name.trim()) {
      toast.error('Subject name is required')
      return
    }

    if (!formData.code.trim()) {
      toast.error('Subject code is required')
      return
    }

    // Include campus_id for new subjects
    const submitData = editingSubject
      ? { name: formData.name, code: formData.code, subject_type: formData.subject_type }
      : { ...formData, campus_id: selectedCampus?.id }

    const result = editingSubject
      ? await academicsApi.updateSubject(editingSubject.id, submitData)
      : await academicsApi.createSubject(submitData)

    if (result.success) {
      toast.success(`Subject ${editingSubject ? 'updated' : 'created'} successfully`)
      handleCloseDialog()
      fetchSubjects()
    } else {
      toast.error(result.error || `Failed to ${editingSubject ? 'update' : 'create'} subject`)
    }
  }

  const handleDeleteClick = (subjectId: string) => {
    setSubjectToDelete(subjectId)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!subjectToDelete) return

    const result = await academicsApi.deleteSubject(subjectToDelete)

    if (result.success) {
      toast.success('Subject deleted successfully')
      fetchSubjects()
    } else {
      toast.error(result.error || 'Failed to delete subject')
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
          <h1 className="text-3xl font-bold tracking-tight">Subjects</h1>
          <p className="text-muted-foreground">
            Define curriculum subjects for each grade level
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Subject
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Subjects</CardTitle>
              <CardDescription>View and manage curriculum subjects</CardDescription>
            </div>
            <div className="w-[200px]">
              <Select value={filterGrade} onValueChange={setFilterGrade}>
                <SelectTrigger>
                  <SelectValue placeholder="All Grades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
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
            <div className="text-center py-8">Loading...</div>
          ) : subjects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No subjects found. Add your first subject to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Grade Level</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                        {subject.subject_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={subject.is_active ? 'default' : 'secondary'}>
                        {subject.is_active ? 'Active' : 'Inactive'}
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
            <DialogTitle>{editingSubject ? 'Edit Subject' : 'Add Subject'}</DialogTitle>
            <DialogDescription>
              {editingSubject
                ? 'Update the details of this subject'
                : 'Create a new subject for a grade level'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="grade_level_id">Grade Level *</Label>
                <Select
                  value={formData.grade_level_id}
                  onValueChange={(value) => setFormData({ ...formData, grade_level_id: value })}
                  disabled={!!editingSubject}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade level" />
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
                  Subject will only be available for this grade
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Subject Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Mathematics, Physics, Biology"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Subject Code *</Label>
                <Input
                  id="code"
                  placeholder="e.g., MATH-10, PHY-10, BIO-10"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Unique identifier for this subject
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject_type">Type *</Label>
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
                    <SelectItem value="theory">Theory</SelectItem>
                    <SelectItem value="lab">Lab</SelectItem>
                    <SelectItem value="practical">Practical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit">{editingSubject ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this subject. Make sure no teachers are assigned to this
              subject before deleting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSubjectToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
