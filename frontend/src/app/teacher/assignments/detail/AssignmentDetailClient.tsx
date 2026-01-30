"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { 
  ArrowLeft, Calendar, Users, Clock,
  Loader2, Paperclip, X, Upload, Save, Trash2, 
  FileText, Download, Edit
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import * as assignmentsApi from "@/lib/api/assignments"
import { createClient } from "@/lib/supabase/client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export default function AssignmentDetailClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const assignmentId = searchParams.get('id')
  const { profile } = useAuth()
  
  const [assignment, setAssignment] = useState<assignmentsApi.Assignment | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const instructionsRef = useRef<HTMLDivElement>(null)

  // Edit form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    instructions: '',
    due_date: '',
    due_time: '',
    max_score: 100,
    is_graded: true,
    allow_late_submission: false,
    is_published: true
  })

  useEffect(() => {
    if (assignmentId) {
      loadAssignment()
    } else {
      setLoading(false)
    }
  }, [assignmentId])

  const loadAssignment = async () => {
    if (!assignmentId) return
    
    try {
      setLoading(true)
      const data = await assignmentsApi.getAssignment(assignmentId)
      setAssignment(data)
      // Populate form data
      setFormData({
        title: data.title || '',
        description: data.description || '',
        instructions: data.instructions || '',
        due_date: data.due_date || '',
        due_time: data.due_time || '',
        max_score: data.max_score || 100,
        is_graded: data.is_graded ?? true,
        allow_late_submission: data.allow_late_submission ?? false,
        is_published: data.is_published ?? true
      })
    } catch (error: any) {
      console.error('Error loading assignment:', error)
      toast.error('Failed to load assignment')
      router.push('/teacher/assignments')
    } finally {
      setLoading(false)
    }
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

      const { data: urlData } = supabase.storage
        .from('Assignments_uploads')
        .getPublicUrl(data.path)

      uploadedUrls.push(urlData.publicUrl)
    }

    return uploadedUrls
  }

  const handleSave = async () => {
    if (!assignment || !assignmentId || saving) return

    try {
      setSaving(true)

      // Upload new files if any
      let newAttachmentUrls: string[] = []
      if (uploadedFiles.length > 0) {
        setUploadingFiles(true)
        try {
          newAttachmentUrls = await uploadFilesToStorage(uploadedFiles)
        } catch (uploadError: any) {
          toast.error(uploadError.message || 'Failed to upload files')
          return
        } finally {
          setUploadingFiles(false)
        }
      }

      // Combine existing and new attachments
      const allAttachments = [
        ...(assignment.attachments || []),
        ...newAttachmentUrls
      ]

      const dto: assignmentsApi.UpdateAssignmentDTO = {
        title: formData.title,
        description: formData.description || undefined,
        instructions: formData.instructions || undefined,
        due_date: formData.due_date,
        due_time: formData.due_time || undefined,
        max_score: formData.max_score,
        is_graded: formData.is_graded,
        allow_late_submission: formData.allow_late_submission,
        is_published: formData.is_published,
        attachments: allAttachments
      }

      await assignmentsApi.updateAssignment(assignmentId, dto)
      toast.success('Assignment updated successfully! Changes will reflect for all students.')
      setIsEditing(false)
      setUploadedFiles([])
      loadAssignment()
    } catch (error: any) {
      console.error('Error updating assignment:', error)
      toast.error(error.message || 'Failed to update assignment')
    } finally {
      setSaving(false)
      setUploadingFiles(false)
    }
  }

  const handleDelete = async () => {
    if (!assignmentId) return
    
    try {
      await assignmentsApi.deleteAssignment(assignmentId)
      toast.success('Assignment deleted successfully')
      router.push('/teacher/assignments')
    } catch (error: any) {
      console.error('Error deleting assignment:', error)
      toast.error(error.message || 'Failed to delete assignment')
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

  const removeExistingAttachment = (index: number) => {
    if (assignment) {
      const newAttachments = [...(assignment.attachments || [])]
      newAttachments.splice(index, 1)
      setAssignment({ ...assignment, attachments: newAttachments })
    }
  }

  // Detect text direction based on first character
  const detectTextDirection = (text: string): 'ltr' | 'rtl' => {
    const rtlChars = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
    const firstChar = text.replace(/<[^>]*>/g, '').trim().charAt(0)
    return rtlChars.test(firstChar) ? 'rtl' : 'ltr'
  }

  const getFileName = (url: string) => {
    const parts = url.split('/')
    return decodeURIComponent(parts[parts.length - 1])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!assignmentId || !assignment) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Assignment not found</p>
        <Button onClick={() => router.push('/teacher/assignments')} className="mt-4">
          Go Back
        </Button>
      </div>
    )
  }

  const isOverdue = new Date(assignment.due_date) < new Date()

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/teacher/assignments')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-brand-blue dark:text-white">
              {isEditing ? 'Edit Assignment' : 'Assignment Details'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {assignment.section?.grade_level?.name} - {assignment.section?.name} | {assignment.subject?.name}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {!isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/teacher/assignments/submissions?id=${assignmentId}`)}
              >
                <Users className="h-4 w-4 mr-2" />
                Submissions
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Assignment?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this assignment and all student submissions. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => {
                setIsEditing(false)
                loadAssignment() // Reset form data
              }}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={saving || uploadingFiles}
                style={{ background: 'var(--gradient-blue)' }}
                className="text-white"
              >
                {saving || uploadingFiles ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {uploadingFiles ? 'Uploading...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex gap-2 flex-wrap">
        <Badge variant={assignment.is_published ? 'default' : 'secondary'}>
          {assignment.is_published ? 'Published' : 'Draft'}
        </Badge>
        {assignment.is_graded && (
          <Badge variant="outline">Graded</Badge>
        )}
        {assignment.allow_late_submission && (
          <Badge variant="outline">Late Submissions Allowed</Badge>
        )}
        {isOverdue && (
          <Badge variant="destructive">Overdue</Badge>
        )}
      </div>

      {/* Main Content */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="font-medium">Title</Label>
            {isEditing ? (
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Assignment title"
              />
            ) : (
              <p className="text-lg font-semibold">{assignment.title}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="font-medium">Description</Label>
            {isEditing ? (
              <textarea
                className="w-full min-h-[100px] p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-blue"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the assignment..."
                dir="auto"
              />
            ) : (
              <p className="text-muted-foreground" dir="auto">
                {assignment.description || 'No description provided'}
              </p>
            )}
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <Label className="font-medium">Instructions</Label>
            {isEditing ? (
              <div className="border rounded-lg overflow-hidden">
                <div className="flex items-center gap-1 p-2 border-b bg-muted/50">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 font-bold"
                    onClick={() => document.execCommand('bold')}
                    title="Bold"
                  >
                    B
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 italic"
                    onClick={() => document.execCommand('italic')}
                    title="Italic"
                  >
                    I
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
                <div
                  ref={instructionsRef}
                  contentEditable
                  className="min-h-[150px] p-3 focus:outline-none"
                  onInput={(e) => {
                    const html = e.currentTarget.innerHTML
                    const text = e.currentTarget.textContent || ''
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
            ) : (
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: assignment.instructions || 'No instructions provided' }}
                dir="auto"
              />
            )}
          </div>

          {/* Due Date & Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="font-medium">Due Date</Label>
              {isEditing ? (
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{new Date(assignment.due_date).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="font-medium">Due Time</Label>
              {isEditing ? (
                <Input
                  type="time"
                  value={formData.due_time}
                  onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{assignment.due_time || 'No specific time'}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="font-medium">Max Score</Label>
              {isEditing ? (
                <Input
                  type="number"
                  value={formData.max_score}
                  onChange={(e) => setFormData({ ...formData, max_score: Number(e.target.value) })}
                  min={1}
                />
              ) : (
                <span className="font-medium">{assignment.max_score} points</span>
              )}
            </div>
          </div>

          {/* Toggles */}
          {isEditing && (
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_graded}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_graded: checked })}
                />
                <Label>Graded Assignment</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.allow_late_submission}
                  onCheckedChange={(checked) => setFormData({ ...formData, allow_late_submission: checked })}
                />
                <Label>Allow Late Submissions</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_published}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
                />
                <Label>Published</Label>
              </div>
            </div>
          )}

          {/* Attachments */}
          <div className="space-y-4">
            <Label className="font-medium">Attachments</Label>
            
            {/* Existing attachments */}
            {assignment.attachments && assignment.attachments.length > 0 && (
              <div className="space-y-2">
                {assignment.attachments.map((url, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <a 
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-brand-blue hover:underline"
                      >
                        {getFileName(url)}
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a href={url} download target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      {isEditing && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeExistingAttachment(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload new files (edit mode) */}
            {isEditing && (
              <div className="border-2 border-dashed rounded-lg p-4 hover:border-brand-blue transition-colors">
                <div className="flex flex-col items-center justify-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div className="text-center">
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <span className="text-sm font-medium text-brand-blue hover:underline">
                        Click to upload more files
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
                      PDF, Word, Images (Max 10MB each)
                    </p>
                  </div>
                </div>
                
                {uploadedFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
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
            )}

            {!isEditing && (!assignment.attachments || assignment.attachments.length === 0) && (
              <p className="text-sm text-muted-foreground">No attachments</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
