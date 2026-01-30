"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Plus, Calendar, Users, CheckCircle, Clock, BookOpen, Trash2, Edit, Eye, Loader2, Paperclip, X, Upload, Search } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import * as assignmentsApi from "@/lib/api/assignments"
import * as teachersApi from "@/lib/api/teachers"
import * as academicsApi from "@/lib/api/academics"
import { createClient } from "@/lib/supabase/client"
import { PaginationWrapper } from "@/components/ui/pagination"

const ITEMS_PER_PAGE = 10

export default function TeacherAssignmentsPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const [assignments, setAssignments] = useState<assignmentsApi.Assignment[]>([])
  const [teacherAssignments, setTeacherAssignments] = useState<teachersApi.TeacherSubjectAssignment[]>([])
  const [sections, setSections] = useState<academicsApi.Section[]>([])
  const [subjects, setSubjects] = useState<academicsApi.Subject[]>([])
  const [currentAcademicYear, setCurrentAcademicYear] = useState<teachersApi.AcademicYear | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'upcoming' | 'past'>('active')
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const instructionsRef = useRef<HTMLDivElement>(null)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalAssignments, setTotalAssignments] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    grade_level_id: '',
    section_id: '',
    subject_id: '',
    title: '',
    description: '',
    instructions: '',
    due_date: '',
    due_time: '',
    max_score: 100,
    is_graded: true,
    allow_late_submission: false
  })

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCurrentPage(1) // Reset to first page on search
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Load initial data
  useEffect(() => {
    if (profile?.staff_id && profile?.school_id) {
      loadInitialData()
    }
  }, [profile])

  // Fetch assignments when filter, page, or search changes
  useEffect(() => {
    if (profile?.staff_id) {
      fetchAssignments()
    }
  }, [profile?.staff_id, filter, currentPage, debouncedSearch])

  const loadInitialData = async () => {
    if (!profile?.staff_id || !profile?.school_id) return

    try {
      setLoading(true)

      // Fetch teacher's subject assignments (what they teach) and current academic year
      const [teacherAssignmentsData, academicYear] = await Promise.all([
        teachersApi.getTeacherAssignments(),
        teachersApi.getCurrentAcademicYear()
      ])
      setTeacherAssignments(teacherAssignmentsData)
      setCurrentAcademicYear(academicYear)

      // Fetch all sections and subjects for the teacher's campus (school_id)
      const [sectionsRes, subjectsRes] = await Promise.all([
        academicsApi.getSections(), // Will be filtered by school_id in backend
        academicsApi.getSubjects()   // Will be filtered by school_id in backend
      ])
      
      // Extract data from ApiResponse
      if (sectionsRes.success && sectionsRes.data) {
        setSections(sectionsRes.data)
      } else {
        throw new Error(sectionsRes.error || 'Failed to fetch sections')
      }
      
      if (subjectsRes.success && subjectsRes.data) {
        setSubjects(subjectsRes.data)
      } else {
        throw new Error(subjectsRes.error || 'Failed to fetch subjects')
      }
    } catch (error: any) {
      console.error('Error loading data:', error)
      toast.error(error.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const fetchAssignments = async () => {
    if (!profile?.staff_id) return

    try {
      const result = await assignmentsApi.getTeacherAssignments(profile.staff_id, {
        is_archived: false,
        status: filter,
        search: debouncedSearch || undefined,
        page: currentPage,
        limit: ITEMS_PER_PAGE
      })
      setAssignments(result.data)
      setTotalPages(result.totalPages)
      setTotalAssignments(result.total)
    } catch (error: any) {
      console.error('Error fetching assignments:', error)
      toast.error(error.message || 'Failed to load assignments')
    }
  }

  const handleFilterChange = (newFilter: 'all' | 'active' | 'upcoming' | 'past') => {
    setFilter(newFilter)
    setCurrentPage(1) // Reset to first page when filter changes
  }

  // Upload files to Supabase storage
  const uploadFilesToStorage = async (files: File[]): Promise<string[]> => {
    const supabase = createClient()
    const uploadedUrls: string[] = []

    for (const file of files) {
      const fileExt = file.name.split('.').pop()
      const fileName = `${profile?.staff_id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      
      const { data, error } = await supabase.storage
        .from('Assignments_uploads')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('Upload error:', error)
        throw new Error(`Failed to upload ${file.name}: ${error.message}`)
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('Assignments_uploads')
        .getPublicUrl(data.path)

      uploadedUrls.push(urlData.publicUrl)
    }

    return uploadedUrls
  }

  const handleCreateAssignment = async () => {
    if (!profile?.staff_id || !profile?.school_id) return
    if (submitting) return // Prevent double submission

    try {
      setSubmitting(true)

      if (!formData.section_id || !formData.subject_id || !formData.title || !formData.due_date) {
        toast.error('Please fill in all required fields')
        return
      }

      if (!currentAcademicYear) {
        toast.error('No current academic year found. Please contact administrator.')
        return
      }

      // Upload files to Supabase storage
      let attachmentUrls: string[] = []
      if (uploadedFiles.length > 0) {
        setUploadingFiles(true)
        try {
          attachmentUrls = await uploadFilesToStorage(uploadedFiles)
          toast.success(`${uploadedFiles.length} file(s) uploaded successfully!`)
        } catch (uploadError: any) {
          toast.error(uploadError.message || 'Failed to upload files')
          return
        } finally {
          setUploadingFiles(false)
        }
      }

      const dto: assignmentsApi.CreateAssignmentDTO = {
        school_id: profile.school_id,
        campus_id: profile.school_id, // Use current school_id as campus_id for multi-campus support
        teacher_id: profile.staff_id,
        section_id: formData.section_id,
        subject_id: formData.subject_id,
        academic_year_id: currentAcademicYear.id,  // Use actual academic year UUID
        title: formData.title,
        description: formData.description || undefined,
        instructions: formData.instructions || undefined,
        assigned_date: new Date().toISOString().split('T')[0],
        due_date: formData.due_date,
        due_time: formData.due_time || undefined,
        max_score: formData.max_score,
        is_graded: formData.is_graded,
        allow_late_submission: formData.allow_late_submission,
        attachments: attachmentUrls,
        is_published: true,
        created_by: profile.id
      }

      await assignmentsApi.createAssignment(dto)
      toast.success('Assignment created successfully!')
      setIsDialogOpen(false)
      resetForm()
      loadData()
    } catch (error: any) {
      console.error('Error creating assignment:', error)
      toast.error(error.message || 'Failed to create assignment')
    } finally {
      setSubmitting(false)
      setUploadingFiles(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const validFiles = files.filter(file => {
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        toast.error(`${file.name} is too large. Max size is 10MB`)
        return false
      }
      return true
    })
    setUploadedFiles(prev => [...prev, ...validFiles])
  }

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const resetForm = () => {
    setFormData({
      grade_level_id: '',
      section_id: '',
      subject_id: '',
      title: '',
      description: '',
      instructions: '',
      due_date: '',
      due_time: '',
      max_score: 100,
      is_graded: true,
      allow_late_submission: false
    })
    setUploadedFiles([])
    // Clear the rich text editor
    if (instructionsRef.current) {
      instructionsRef.current.innerHTML = ''
    }
  }

  // Detect text direction based on first character
  const detectTextDirection = (text: string): 'ltr' | 'rtl' => {
    const rtlChars = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
    const firstChar = text.replace(/<[^>]*>/g, '').trim().charAt(0)
    return rtlChars.test(firstChar) ? 'rtl' : 'ltr'
  }

  // Removed client-side filtering - now handled server-side

  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date()
    const due = new Date(dueDate)
    const diffTime = due.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getDueDateColor = (dueDate: string) => {
    const days = getDaysUntilDue(dueDate)
    if (days < 0) return 'text-red-600'
    if (days <= 2) return 'text-orange-600'
    if (days <= 7) return 'text-yellow-600'
    return 'text-green-600'
  }

  // Get unique grade levels teacher teaches - directly from teacherAssignments
  const getTeacherGradeLevels = () => {
    // Extract grade levels from teacher's section assignments
    const gradeLevelsMap = new Map<string, { id: string; name: string }>()
    
    teacherAssignments.forEach(ta => {
      const section = ta.section as any
      if (section?.grade_level?.id && section?.grade_level?.name) {
        gradeLevelsMap.set(section.grade_level.id, {
          id: section.grade_level.id,
          name: section.grade_level.name
        })
      }
    })
    
    return Array.from(gradeLevelsMap.values())
  }

  // Get sections for selected grade level that teacher teaches
  const getSectionsForGrade = () => {
    if (!formData.grade_level_id) return []
    
    // Get sections directly from teacher assignments that match the grade level
    const sectionsMap = new Map<string, { id: string; name: string; grade_level_id: string }>()
    
    teacherAssignments.forEach(ta => {
      const section = ta.section as any
      if (section?.grade_level?.id === formData.grade_level_id) {
        sectionsMap.set(section.id, {
          id: section.id,
          name: section.name,
          grade_level_id: section.grade_level.id
        })
      }
    })
    
    return Array.from(sectionsMap.values())
  }

  // Get subjects teacher can assign for selected section
  const getAvailableSubjects = () => {
    if (!formData.section_id) return []
    
    // Get subjects directly from teacher assignments for the selected section
    return teacherAssignments
      .filter(ta => ta.section_id === formData.section_id)
      .map(ta => {
        const subject = ta.subject as any
        return {
          id: ta.subject_id,
          name: subject?.name || 'Unknown'
        }
      })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-brand-blue dark:text-white">My Assignments</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage assignments for your classes
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button style={{ background: 'var(--gradient-blue)' }} className="text-white">
              <Plus className="h-4 w-4 mr-2" />
              Create Assignment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Assignment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="grade">Grade Level *</Label>
                  <Select
                    value={formData.grade_level_id}
                    onValueChange={(value) => setFormData({ ...formData, grade_level_id: value, section_id: '', subject_id: '' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {getTeacherGradeLevels().map((grade) => (
                        <SelectItem key={grade.id} value={grade.id}>
                          {grade.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="section">Section *</Label>
                  <Select
                    value={formData.section_id}
                    onValueChange={(value) => setFormData({ ...formData, section_id: value, subject_id: '' })}
                    disabled={!formData.grade_level_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {getSectionsForGrade().map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject *</Label>
                  <Select
                    value={formData.subject_id}
                    onValueChange={(value) => setFormData({ ...formData, subject_id: value })}
                    disabled={!formData.section_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableSubjects().map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Assignment Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Chapter 5 Exercises"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the assignment"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions">Instructions (Rich Text)</Label>
                <div className="border rounded-md">
                  {/* Rich text toolbar */}
                  <div className="flex items-center gap-1 p-2 border-b bg-muted/30">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => document.execCommand('bold')}
                      title="Bold"
                    >
                      <span className="font-bold">B</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => document.execCommand('italic')}
                      title="Italic"
                    >
                      <span className="italic">I</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => document.execCommand('underline')}
                      title="Underline"
                    >
                      <span className="underline">U</span>
                    </Button>
                    <div className="w-px h-6 bg-border mx-1" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => document.execCommand('insertUnorderedList')}
                      title="Bullet List"
                    >
                      • List
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => document.execCommand('insertOrderedList')}
                      title="Numbered List"
                    >
                      1. List
                    </Button>
                    <div className="w-px h-6 bg-border mx-1" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => {
                        if (instructionsRef.current) {
                          instructionsRef.current.dir = 'ltr'
                          instructionsRef.current.style.textAlign = 'left'
                        }
                      }}
                      title="Left to Right (English)"
                    >
                      LTR
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => {
                        if (instructionsRef.current) {
                          instructionsRef.current.dir = 'rtl'
                          instructionsRef.current.style.textAlign = 'right'
                        }
                      }}
                      title="Right to Left (Arabic)"
                    >
                      RTL
                    </Button>
                  </div>
                  {/* Contenteditable div for rich text with RTL/LTR support */}
                  <div
                    ref={instructionsRef}
                    contentEditable
                    className="min-h-[120px] p-3 focus:outline-none"
                    onInput={(e) => {
                      const html = e.currentTarget.innerHTML
                      const text = e.currentTarget.textContent || ''
                      // Auto-detect direction on first character
                      if (text.length === 1) {
                        const dir = detectTextDirection(text)
                        e.currentTarget.dir = dir
                        e.currentTarget.style.textAlign = dir === 'rtl' ? 'right' : 'left'
                      }
                      setFormData({ ...formData, instructions: html })
                    }}
                    dangerouslySetInnerHTML={{ __html: formData.instructions }}
                    style={{ whiteSpace: 'pre-wrap' }}
                    dir="auto"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Use the toolbar to format your instructions. Click LTR for English or RTL for Arabic.</p>
              </div>

              {/* File Upload Section */}
              <div className="space-y-2">
                <Label>Attachments</Label>
                <div className="border-2 border-dashed rounded-lg p-4 hover:border-brand-blue transition-colors">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <div className="text-center">
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <span className="text-sm font-medium text-brand-blue hover:underline">
                          Click to upload files
                        </span>
                        <input
                          id="file-upload"
                          type="file"
                          multiple
                          className="hidden"
                          onChange={handleFileSelect}
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        />
                      </label>
                      <p className="text-xs text-muted-foreground mt-1">
                        PDF, Word Documents, Images (Max 10MB each)
                      </p>
                    </div>
                  </div>
                  
                  {/* Selected files list */}
                  {uploadedFiles.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                          <div className="flex items-center gap-2">
                            <Paperclip className="h-4 w-4" />
                            <span className="text-sm">{file.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({(file.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date *</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="due_time">Due Time</Label>
                  <Input
                    id="due_time"
                    type="time"
                    value={formData.due_time}
                    onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_score">Max Score</Label>
                  <Input
                    id="max_score"
                    type="number"
                    value={formData.max_score}
                    onChange={(e) => setFormData({ ...formData, max_score: Number(e.target.value) })}
                    min={1}
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_graded}
                    onChange={(e) => setFormData({ ...formData, is_graded: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Graded assignment</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allow_late_submission}
                    onChange={(e) => setFormData({ ...formData, allow_late_submission: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Allow late submissions</span>
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleCreateAssignment}
                  disabled={submitting || uploadingFiles}
                  style={{ background: 'var(--gradient-blue)' }}
                  className="flex-1 text-white"
                >
                  {submitting || uploadingFiles ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {uploadingFiles ? 'Uploading Files...' : 'Creating...'}
                    </>
                  ) : (
                    'Create Assignment'
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setIsDialogOpen(false)
                    resetForm()
                  }}
                  variant="outline"
                  className="flex-1"
                  disabled={submitting || uploadingFiles}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assignments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Filter Tabs */}
        <div className="flex gap-2">
          {[
            { key: 'active', label: 'Active' },
            { key: 'upcoming', label: 'Upcoming' },
            { key: 'past', label: 'Past' },
            { key: 'all', label: 'All' }
          ].map((tab) => (
            <Button
              key={tab.key}
              variant={filter === tab.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange(tab.key as any)}
              style={filter === tab.key ? { background: 'var(--gradient-blue)' } : undefined}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Showing X of Y entries */}
      {totalAssignments > 0 && (
        <p className="text-sm text-muted-foreground">
          Showing {assignments.length} of {totalAssignments} assignments
        </p>
      )}

      {/* Assignments List */}
      {assignments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assignments.map((assignment) => {
            const daysUntil = getDaysUntilDue(assignment.due_date)
            const isOverdue = daysUntil < 0

            return (
              <Card key={assignment.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg line-clamp-2">{assignment.title}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {assignment.subject?.name}
                      </p>
                    </div>
                    {assignment.is_graded && (
                      <Badge variant="outline" className="ml-2">
                        {assignment.max_score} pts
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{assignment.section?.name} - {assignment.section?.grade_level?.name}</span>
                  </div>

                  <div className={`flex items-center gap-2 text-sm font-medium ${getDueDateColor(assignment.due_date)}`}>
                    <Calendar className="h-4 w-4" />
                    <span>
                      Due: {new Date(assignment.due_date).toLocaleDateString()}
                      {isOverdue ? ' (Overdue)' : ` (${daysUntil} days)`}
                    </span>
                  </div>

                  {assignment.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {assignment.description}
                    </p>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => router.push(`/teacher/assignments/detail?id=${assignment.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/teacher/assignments/submissions?id=${assignment.id}`)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Submissions
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">No assignments found</p>
            <p className="text-sm text-muted-foreground mt-2">
              {searchQuery ? 'Try a different search term' : 'Create your first assignment to get started'}
            </p>
            {!searchQuery && (
              <Button
                onClick={() => setIsDialogOpen(true)}
                className="mt-4"
                style={{ background: 'var(--gradient-blue)' }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Assignment
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <PaginationWrapper
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalAssignments}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
          variant="gradient"
        />
      )}
    </div>
  )
}
