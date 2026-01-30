"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Plus, Search, Trash2, ClipboardList, Users, BookOpen, Loader2, AlertCircle } from "lucide-react"
import * as teachersApi from "@/lib/api/teachers"
import * as academicsApi from "@/lib/api/academics"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAcademic } from "@/context/AcademicContext"

export default function WorkloadPage() {
  const { selectedAcademicYear, currentAcademicYear } = useAcademic()
  const [assignments, setAssignments] = useState<teachersApi.TeacherSubjectAssignment[]>([])
  const [teachers, setTeachers] = useState<teachersApi.Staff[]>([])
  const [gradeLevels, setGradeLevels] = useState<academicsApi.GradeLevel[]>([])
  const [sections, setSections] = useState<academicsApi.Section[]>([])
  const [subjects, setSubjects] = useState<academicsApi.Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState("")
  const [conflictWarning, setConflictWarning] = useState("")

  // Form state with cascading filters (removed academic_year_id)
  const [formData, setFormData] = useState({
    teacher_id: "",
    subject_id: "",
    section_id: "",
    is_primary: true
  })
  
  // Cascading dropdown states
  const [selectedGrade, setSelectedGrade] = useState("")
  const [filteredSections, setFilteredSections] = useState<academicsApi.Section[]>([])
  const [filteredSubjects, setFilteredSubjects] = useState<academicsApi.Subject[]>([])

  useEffect(() => {
    loadData()
  }, [])

  // Cascade effect: When grade changes, filter sections and subjects
  useEffect(() => {
    if (selectedGrade) {
      console.log('Selected Grade:', selectedGrade)
      console.log('All Sections:', sections)
      console.log('All Subjects:', subjects)
      
      // Use String() to ensure type matching
      const filteredSections = sections.filter(s => {
        const match = String(s.grade_level_id) === String(selectedGrade) && s.is_active
        console.log(`Section ${s.name}: grade_level_id=${s.grade_level_id}, selectedGrade=${selectedGrade}, match=${match}`)
        return match
      })
      
      const filteredSubjects = subjects.filter(s => {
        const match = String(s.grade_level_id) === String(selectedGrade) && s.is_active
        console.log(`Subject ${s.name}: grade_level_id=${s.grade_level_id}, selectedGrade=${selectedGrade}, match=${match}`)
        return match
      })
      
      console.log('Filtered Sections:', filteredSections)
      console.log('Filtered Subjects:', filteredSubjects)
      
      setFilteredSections(filteredSections)
      setFilteredSubjects(filteredSubjects)
    } else {
      setFilteredSections([])
      setFilteredSubjects([])
    }
  }, [selectedGrade, sections, subjects])

  // Check for conflicts when teacher, subject, or section changes
  useEffect(() => {
    if (formData.teacher_id && formData.subject_id && formData.section_id) {
      checkExistingAssignment()
    } else {
      setConflictWarning("")
    }
  }, [formData.teacher_id, formData.subject_id, formData.section_id])

  const loadData = async () => {
    try {
      setLoading(true)
      const [assignmentsRes, teachersRes, gradesRes, sectionsRes, subjectsRes] = await Promise.all([
        teachersApi.getTeacherAssignments(),
        teachersApi.getAllTeachers({ limit: 1000 }), // Get all teachers without pagination for workload page
        academicsApi.getGradeLevels(),
        academicsApi.getSections(),
        academicsApi.getSubjects()
      ])
      
      setAssignments(assignmentsRes)
      setTeachers((teachersRes.data || teachersRes).filter((t: any) => t.is_active))
      setGradeLevels(gradesRes.data || [])
      setSections(sectionsRes.data || [])
      setSubjects(subjectsRes.data || [])
    } catch (error: any) {
      toast.error(error.message || "Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  const checkExistingAssignment = () => {
    // Check if another teacher is already assigned to this subject-section combo
    const existing = assignments.find(
      a => 
        a.subject_id === formData.subject_id && 
        a.section_id === formData.section_id &&
        a.academic_year_id === selectedAcademicYear &&
        a.is_primary === true &&
        a.teacher_id !== formData.teacher_id
    )
    
    if (existing) {
      const teacherName = existing.teacher_name || 'Unknown Teacher'
      setConflictWarning(`⚠️ ${teacherName} is already the primary teacher for this subject-section combination.`)
    } else {
      setConflictWarning("")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedAcademicYear) {
      toast.error("Please select an academic year from the top menu")
      return
    }
    
    try {
      const assignmentData = {
        ...formData,
        academic_year_id: selectedAcademicYear
      }
      
      console.log('Submitting assignment data:', assignmentData)
      console.log('Selected academic year:', selectedAcademicYear)
      
      await teachersApi.createTeacherAssignment(assignmentData as any)
      toast.success("Assignment created successfully")
      setIsDialogOpen(false)
      resetForm()
      loadData()
    } catch (error: any) {
      console.error('Error creating teacher assignment:', error)
      toast.error(error.message || "Failed to create assignment")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this assignment?")) return

    try {
      await teachersApi.deleteTeacherAssignment(id)
      toast.success("Assignment removed successfully")
      loadData()
    } catch (error: any) {
      toast.error(error.message || "Failed to remove assignment")
    }
  }

  const resetForm = () => {
    setFormData({
      teacher_id: "",
      subject_id: "",
      section_id: "",
      is_primary: true
    })
    setSelectedGrade("")
    setConflictWarning("")
  }

  const filteredAssignments = assignments.filter((assignment) => {
    if (selectedTeacher && assignment.teacher_id !== selectedTeacher) return false
    if (selectedAcademicYear && assignment.academic_year_id !== selectedAcademicYear) return false
    
    const teacherName = assignment.teacher_name
    const query = searchQuery.toLowerCase()
    return (
      teacherName?.toLowerCase().includes(query) ||
      assignment.subject_name?.toLowerCase().includes(query) ||
      assignment.section_name?.toLowerCase().includes(query)
    )
  })

  // Group assignments by teacher
  const assignmentsByTeacher = filteredAssignments.reduce((acc, assignment) => {
    const teacherId = assignment.teacher_id
    if (!acc[teacherId]) {
      acc[teacherId] = []
    }
    acc[teacherId].push(assignment)
    return acc
  }, {} as Record<string, typeof assignments>)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-brand-blue dark:text-white">Teacher Workload</h1>
          <p className="text-muted-foreground">Assign teachers to subjects and sections</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button 
              style={{ background: 'var(--gradient-blue)' }}
              className="text-white hover:opacity-90 transition-opacity shadow-md"
            >
              <Plus className="h-4 w-4 mr-2" />
              Assign Teacher
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Assign Teacher to Class (Step 1: Workload Allocation)</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!selectedAcademicYear && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please select an academic year from the top menu before assigning teachers.
                  </AlertDescription>
                </Alert>
              )}
              
              {conflictWarning && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{conflictWarning}</AlertDescription>
                </Alert>
              )}
              
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label>Teacher *</Label>
                  <Select
                    value={formData.teacher_id}
                    onValueChange={(value) => setFormData({ ...formData, teacher_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.profile?.first_name} {teacher.profile?.last_name} ({teacher.employee_number})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Step 1: Select Grade → Step 2: Select Section → Step 3: Select Subject
                  </p>
                </div>

                <div>
                  <Label>Grade Level *</Label>
                  <Select
                    value={selectedGrade}
                    onValueChange={(value) => {
                      setSelectedGrade(value)
                      // Reset dependent fields
                      setFormData({ ...formData, section_id: "", subject_id: "" })
                    }}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Step 1: Select grade first" />
                    </SelectTrigger>
                    <SelectContent>
                      {gradeLevels
                        .filter(g => g.is_active)
                        .sort((a, b) => a.order_index - b.order_index)
                        .map((grade) => (
                          <SelectItem key={grade.id} value={grade.id}>
                            {grade.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Section *</Label>
                  <Select
                    value={formData.section_id}
                    onValueChange={(value) => setFormData({ ...formData, section_id: value })}
                    disabled={!selectedGrade}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selectedGrade ? "Step 2: Select section" : "Select grade first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSections.map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.name} (Capacity: {section.capacity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Subject *</Label>
                  <Select
                    value={formData.subject_id}
                    onValueChange={(value) => setFormData({ ...formData, subject_id: value })}
                    disabled={!selectedGrade}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selectedGrade ? "Step 3: Select subject" : "Select grade first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSubjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name} ({subject.code}) - {subject.subject_type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedGrade && filteredSubjects.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      No subjects found for this grade. Please add subjects in Academics → Subjects.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="is_primary"
                    checked={formData.is_primary}
                    onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="is_primary" className="cursor-pointer">
                    Primary Teacher (unchecked means assistant/substitute)
                  </Label>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  style={{ background: 'var(--gradient-blue)' }}
                  className="text-white hover:opacity-90 transition-opacity"
                  disabled={!!conflictWarning && formData.is_primary}
                >
                  Create Assignment
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Assignments</p>
                <h3 className="text-2xl font-bold dark:text-white">{assignments.length}</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-gradient-blue flex items-center justify-center">
                <ClipboardList className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Teachers</p>
                <h3 className="text-2xl font-bold dark:text-white">{Object.keys(assignmentsByTeacher).length}</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-gradient-teal flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Primary Assignments</p>
                <h3 className="text-2xl font-bold dark:text-white">
                  {assignments.filter(a => a.is_primary).length}
                </h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-gradient-orange flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Search className="h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search by teacher, subject, or section..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by teacher" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">All Teachers</SelectItem>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.profile?.first_name} {teacher.profile?.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Assignments Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-linear-to-r from-[#57A3CC]/10 to-[#022172]/10">
                    <TableHead>Teacher</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Academic Year</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Assigned Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No assignments found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAssignments.map((assignment) => {
                      const teacherName = assignment.teacher_name || "N/A"
                      
                      return (
                        <TableRow key={assignment.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">{teacherName}</TableCell>
                          <TableCell>{assignment.subject_name || "—"}</TableCell>
                          <TableCell>{assignment.section_name || "—"}</TableCell>
                          <TableCell>{currentAcademicYear?.name || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={assignment.is_primary ? "default" : "secondary"}>
                              {assignment.is_primary ? "Primary" : "Secondary"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {assignment.assigned_at 
                              ? new Date(assignment.assigned_at).toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(assignment.id)}
                              title="Remove Assignment"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
