'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import {
  getCoursePeriods, getGradebookMatrix, bulkEnterGrades,
  createGradebookAssignment, type GradebookMatrix
} from '@/lib/api/grades'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Loader2, BookOpen, Plus, Save, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

function getPointColor(points: number | null, max: number) {
  if (points === null) return 'text-gray-400'
  const pct = (points / max) * 100
  if (pct >= 90) return 'text-green-700'
  if (pct >= 80) return 'text-blue-700'
  if (pct >= 70) return 'text-yellow-700'
  return 'text-red-700'
}

export default function TeacherGradebookPage() {
  const { user, profile } = useAuth()
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id

  const [selectedCPId, setSelectedCPId] = useState<string>('')
  const [selectedSectionId, setSelectedSectionId] = useState<string>('')

  // Pending unsaved grade changes: {studentId_assignmentId: points}
  const [pendingGrades, setPendingGrades] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // New assignment dialog
  const [showAddAssignment, setShowAddAssignment] = useState(false)
  const [newAssignment, setNewAssignment] = useState({ title: '', points: '100', due_date: '', assignment_type_id: '' })
  const [addingAssignment, setAddingAssignment] = useState(false)

  // Load teacher's course periods
  const { data: cpData } = useSWR(
    user ? ['teacher-course-periods', campusId] : null,
    () => getCoursePeriods(campusId),
    { revalidateOnFocus: false }
  )

  // Filter to teacher's own course periods
  const teacherCPs = (cpData?.data || []).filter(cp =>
    cp.teacher_id === profile?.staff_id || !cp.teacher_id
  )

  const selectedCP = teacherCPs.find(cp => cp.id === selectedCPId)

  // Load gradebook matrix when course period selected
  const { data: matrixData, isLoading: matrixLoading, mutate: refreshMatrix } = useSWR(
    selectedCPId && selectedSectionId ? ['gradebook-matrix', selectedCPId, selectedSectionId] : null,
    () => getGradebookMatrix(selectedCPId, selectedSectionId),
    { revalidateOnFocus: false }
  )

  const matrix: GradebookMatrix | null = matrixData?.data || null

  const handleCPSelect = (cpId: string) => {
    setSelectedCPId(cpId)
    setPendingGrades({})
    const cp = teacherCPs.find(c => c.id === cpId)
    setSelectedSectionId(cp?.section_id || '')
  }

  const cellKey = (studentId: string, assignmentId: string) => `${studentId}_${assignmentId}`

  const getCellValue = (studentId: string, assignmentId: string) => {
    const key = cellKey(studentId, assignmentId)
    if (key in pendingGrades) return pendingGrades[key]
    const grade = matrix?.grades.find(g => g.student_id === studentId && g.assignment_id === assignmentId)
    return grade?.points !== null && grade?.points !== undefined ? String(grade.points) : ''
  }

  const handleCellChange = (studentId: string, assignmentId: string, value: string) => {
    setPendingGrades(prev => ({ ...prev, [cellKey(studentId, assignmentId)]: value }))
  }

  const handleSave = async () => {
    if (!matrix || Object.keys(pendingGrades).length === 0) return
    setSaving(true)
    try {
      // Group by assignment
      const byAssignment: Record<string, Array<{ student_id: string; points: number | null }>> = {}
      for (const [key, val] of Object.entries(pendingGrades)) {
        const [studentId, assignmentId] = key.split('_')
        if (!byAssignment[assignmentId]) byAssignment[assignmentId] = []
        byAssignment[assignmentId].push({
          student_id: studentId,
          points: val === '' ? null : parseFloat(val)
        })
      }

      await Promise.all(
        Object.entries(byAssignment).map(([assignmentId, grades]) =>
          bulkEnterGrades({ assignment_id: assignmentId, course_period_id: selectedCPId, grades })
        )
      )

      setPendingGrades({})
      await refreshMatrix()
      toast.success('Grades saved successfully')
    } catch {
      toast.error('Failed to save grades')
    } finally {
      setSaving(false)
    }
  }

  const handleAddAssignment = async () => {
    if (!newAssignment.title || !newAssignment.assignment_type_id) return
    setAddingAssignment(true)
    try {
      await createGradebookAssignment({
        title: newAssignment.title,
        course_period_id: selectedCPId,
        assignment_type_id: newAssignment.assignment_type_id,
        points: parseFloat(newAssignment.points) || 100,
        due_date: newAssignment.due_date || null
      })
      setShowAddAssignment(false)
      setNewAssignment({ title: '', points: '100', due_date: '', assignment_type_id: '' })
      await refreshMatrix()
      toast.success('Assignment added')
    } catch {
      toast.error('Failed to add assignment')
    } finally {
      setAddingAssignment(false)
    }
  }

  const hasPending = Object.keys(pendingGrades).length > 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Gradebook</h1>
          <p className="text-muted-foreground mt-1">Enter and manage student grades</p>
        </div>
        {selectedCPId && matrix && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAddAssignment(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add Assignment
            </Button>
            <Button onClick={handleSave} disabled={!hasPending || saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save {hasPending ? `(${Object.keys(pendingGrades).length})` : ''}
            </Button>
          </div>
        )}
      </div>

      {/* Course Period Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-muted-foreground shrink-0" />
            <Select value={selectedCPId} onValueChange={handleCPSelect}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Select a class / course period" />
              </SelectTrigger>
              <SelectContent>
                {teacherCPs.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No course periods found</div>
                ) : (
                  teacherCPs.map(cp => (
                    <SelectItem key={cp.id} value={cp.id}>
                      {cp.course?.title || 'Unnamed Course'}
                      {cp.marking_period?.short_name && ` — ${cp.marking_period.short_name}`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedCP?.course?.title && (
              <Badge variant="outline">{selectedCP.course.title}</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Gradebook Matrix */}
      {!selectedCPId ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Select a class to view its gradebook</p>
          </CardContent>
        </Card>
      ) : matrixLoading ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !matrix || matrix.students.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {!selectedSectionId
                ? 'This course period has no section assigned'
                : 'No students found in this section'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {matrix.students.length} students · {matrix.assignments.length} assignments
              </CardTitle>
              {hasPending && (
                <Badge className="bg-amber-100 text-amber-800">
                  {Object.keys(pendingGrades).length} unsaved changes
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold whitespace-nowrap sticky left-0 bg-muted/60 min-w-[180px]">
                      Student
                    </th>
                    {matrix.assignments.map(a => (
                      <th key={a.id} className="px-2 py-3 text-center min-w-[90px]">
                        <div className="font-medium text-xs leading-tight">{a.title}</div>
                        <div className="text-[10px] text-muted-foreground">/{a.points} pts</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {matrix.students.map(student => (
                    <tr key={student.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2 sticky left-0 bg-background font-medium whitespace-nowrap">
                        {student.last_name}, {student.first_name}
                        <span className="text-xs text-muted-foreground ml-2">{student.student_number}</span>
                      </td>
                      {matrix.assignments.map(a => {
                        const val = getCellValue(student.id, a.id)
                        const isPending = cellKey(student.id, a.id) in pendingGrades
                        return (
                          <td key={a.id} className="px-1 py-1 text-center">
                            <input
                              type="number"
                              min={0}
                              max={a.points}
                              value={val}
                              onChange={e => handleCellChange(student.id, a.id, e.target.value)}
                              className={[
                                'w-16 h-8 text-center text-sm rounded border transition-colors',
                                isPending
                                  ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20'
                                  : 'border-transparent hover:border-border bg-transparent',
                                val ? getPointColor(parseFloat(val), a.points) : 'text-gray-400',
                                'focus:outline-none focus:border-primary focus:bg-background'
                              ].join(' ')}
                              placeholder="—"
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Assignment Dialog */}
      <Dialog open={showAddAssignment} onOpenChange={setShowAddAssignment}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input
                value={newAssignment.title}
                onChange={e => setNewAssignment(p => ({ ...p, title: e.target.value }))}
                placeholder="Assignment name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Points</Label>
                <Input
                  type="number"
                  value={newAssignment.points}
                  onChange={e => setNewAssignment(p => ({ ...p, points: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={newAssignment.due_date}
                  onChange={e => setNewAssignment(p => ({ ...p, due_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select
                value={newAssignment.assignment_type_id}
                onValueChange={v => setNewAssignment(p => ({ ...p, assignment_type_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {(matrix?.assignment_types || []).map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAssignment(false)}>Cancel</Button>
            <Button
              onClick={handleAddAssignment}
              disabled={addingAssignment || !newAssignment.title || !newAssignment.assignment_type_id}
            >
              {addingAssignment && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
