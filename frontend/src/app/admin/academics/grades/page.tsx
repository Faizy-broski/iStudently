'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, GraduationCap, Users, BookOpen } from 'lucide-react'
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

export default function GradeLevelsPage() {
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
    base_fee: 0,
  })

  useEffect(() => {
    if (selectedCampus) {
      fetchGrades()
    }
  }, [selectedCampus])

  const fetchGrades = async () => {
    if (!selectedCampus) return
    setLoading(true)
    const result = await academicsApi.getGradeLevels(selectedCampus.id)
    if (result.success && result.data) {
      setGrades(result.data)
    } else {
      toast.error(result.error || 'Failed to fetch grade levels')
    }
    setLoading(false)
  }

  const handleOpenDialog = (grade?: academicsApi.GradeLevel) => {
    if (grade) {
      setEditingGrade(grade)
      setFormData({
        name: grade.name,
        order_index: grade.order_index,
        base_fee: grade.base_fee,
      })
    } else {
      setEditingGrade(null)
      setFormData({
        name: '',
        order_index: grades.length + 1,
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
      base_fee: 0,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error('Grade name is required')
      return
    }

    if (formData.base_fee < 0) {
      toast.error('Base fee cannot be negative')
      return
    }

    setSaving(true)
    try {
      // Include campus_id for new grade levels
      const submitData = editingGrade
        ? formData
        : { ...formData, campus_id: selectedCampus?.id }

      const result = editingGrade
        ? await academicsApi.updateGradeLevel(editingGrade.id, formData)
        : await academicsApi.createGradeLevel(submitData)

      if (result.success) {
        toast.success(`Grade level ${editingGrade ? 'updated' : 'created'} successfully`)
        handleCloseDialog()
        fetchGrades()
      } else {
        toast.error(result.error || `Failed to ${editingGrade ? 'update' : 'create'} grade level`)
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

    const result = await academicsApi.deleteGradeLevel(gradeToDelete)

    if (result.success) {
      toast.success('Grade level deleted successfully')
      fetchGrades()
    } else {
      toast.error(result.error || 'Failed to delete grade level')
    }

    setDeleteDialogOpen(false)
    setGradeToDelete(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Grade Levels</h1>
          <p className="text-muted-foreground">
            Manage grade levels for your school. Grades are the foundation for sections and subjects.
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Grade
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Grade Levels</CardTitle>
          <CardDescription>
            View and manage all grade levels in your school
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : grades.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No grade levels found. Add your first grade level to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Base Fee</TableHead>
                  <TableHead>
                    <Users className="inline mr-1 h-4 w-4" />
                    Sections
                  </TableHead>
                  <TableHead>
                    <BookOpen className="inline mr-1 h-4 w-4" />
                    Subjects
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                    <TableCell>PKR {grade.base_fee.toLocaleString()}</TableCell>
                    <TableCell>{grade.sections_count || 0}</TableCell>
                    <TableCell>{grade.subjects_count || 0}</TableCell>
                    <TableCell>
                      <Badge variant={grade.is_active ? 'default' : 'secondary'}>
                        {grade.is_active ? 'Active' : 'Inactive'}
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
            <DialogTitle>{editingGrade ? 'Edit Grade Level' : 'Add Grade Level'}</DialogTitle>
            <DialogDescription>
              {editingGrade
                ? 'Update the details of this grade level'
                : 'Create a new grade level for your school'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Grade Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Grade 10, Matric, O-Levels"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="order_index">Order Index *</Label>
                <Input
                  id="order_index"
                  type="number"
                  min="1"
                  placeholder="1, 2, 3..."
                  value={formData.order_index || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })
                  }
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Used for sorting: Grade 1=1, Grade 2=2, etc.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="base_fee">Base Fee (PKR) *</Label>
                <Input
                  id="base_fee"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="5000"
                  value={formData.base_fee || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, base_fee: parseFloat(e.target.value) || 0 })
                  }
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Default monthly tuition fee for this grade
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (editingGrade ? 'Updating...' : 'Creating...') : (editingGrade ? 'Update' : 'Create')}
              </Button>
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
              This will permanently delete this grade level. This action cannot be undone. Make sure
              there are no sections or subjects linked to this grade.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setGradeToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
