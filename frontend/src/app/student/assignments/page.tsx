'use client'

import { useState } from 'react'
import { useStudentAssignments } from '@/hooks/useStudentDashboard'
import { submitAssignment } from '@/lib/api/student-dashboard'
import { uploadMultipleFiles } from '@/lib/api/storage'
import { useAuth } from '@/context/AuthContext'
import { ClipboardList, Clock, CheckCircle, Award, Calendar, Send, X, Paperclip, FileText, Download, Upload, Link as LinkIcon } from 'lucide-react'
import { format, isPast, isToday, isTomorrow } from 'date-fns'
import { toast } from 'sonner'

export default function AssignmentsPage() {
  const { profile } = useAuth()
  const { assignments, isLoading, error, refresh } = useStudentAssignments()
  const [submissionDialog, setSubmissionDialog] = useState<{
    open: boolean
    assignment: any | null
  }>({ open: false, assignment: null })
  const [submissionText, setSubmissionText] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const handleOpenSubmission = (assignment: any) => {
    setSubmissionDialog({ open: true, assignment })
    setSubmissionText('')
    setAttachedFiles([])
  }

  const handleCloseSubmission = () => {
    setSubmissionDialog({ open: false, assignment: null })
    setSubmissionText('')
    setAttachedFiles([])
    setUploadProgress(0)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      // Optional: Add file size validation (10MB limit)
      const validFiles = newFiles.filter(file => {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is too large. Max size is 10MB`)
          return false
        }
        return true
      })
      setAttachedFiles(prev => [...prev, ...validFiles])
    }
  }

  const handleRemoveFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getFileName = (url: string) => {
    try {
      // Extract filename from URL
      const urlPath = url.split('?')[0] // Remove query params
      const parts = urlPath.split('/')
      return parts[parts.length - 1] || 'Download'
    } catch {
      return 'Download'
    }
  }

  const handleSubmit = async () => {
    if (!submissionDialog.assignment) return
    
    // Debug: Log profile and assignment data
    console.log('Profile data:', {
      id: profile?.id,
      student_id: profile?.student_id,
      school_id: profile?.school_id,
      campus_id: profile?.campus_id,
    })
    console.log('Assignment data:', {
      id: submissionDialog.assignment.id,
      academic_year_id: submissionDialog.assignment.academic_year_id
    })
    
    // Get user info from auth context
    if (!profile?.id) {
      toast.error('Profile ID not found. Please log in again.')
      return
    }
    
    if (!profile?.student_id) {
      toast.error('Student ID not found. Please log in again.')
      return
    }
    
    if (!profile?.school_id) {
      toast.error('School ID not found. Please log in again.')
      return
    }
    
    if (!profile?.campus_id) {
      toast.error('Campus ID not found. Please log in again.')
      return
    }

    if (!submissionDialog.assignment.academic_year_id) {
      toast.error('Assignment academic year not found.')
      return
    }

    setIsSubmitting(true)
    setUploadProgress(0)
    
    try {
      let fileUrls: string[] = []

      // Upload files to Supabase Storage (production-ready approach)
      if (attachedFiles.length > 0) {
        toast.info('Uploading files...')
        
        const uploadResult = await uploadMultipleFiles(
          attachedFiles,
          profile.id,  // Use profile.id (auth.uid()) for RLS policy match
          submissionDialog.assignment.id,
          profile.school_id,
          profile.campus_id,
          submissionDialog.assignment.academic_year_id,
          (progress) => setUploadProgress(progress)
        )

        if (!uploadResult.success || !uploadResult.urls) {
          toast.error(uploadResult.error || 'Failed to upload files')
          return
        }

        fileUrls = uploadResult.urls
        toast.success('Files uploaded successfully!')
      }

      // Submit assignment with file URLs
      const result = await submitAssignment({
        assignment_id: submissionDialog.assignment.id,
        student_id: profile.student_id,
        submission_text: submissionText,
        attachments: fileUrls.map(url => ({ url, uploaded_at: new Date().toISOString() }))
      })

      if (result.success) {
        toast.success('Assignment submitted successfully!')
        handleCloseSubmission()
        refresh() // Refresh the assignments list
      } else {
        toast.error(result.error || 'Failed to submit assignment')
      }
    } catch (err: any) {
      console.error('Submission error:', err)
      toast.error(err.message || 'Failed to submit assignment')
    } finally {
      setIsSubmitting(false)
      setUploadProgress(0)
    }
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-3 gap-6">
            <div className="h-96 bg-gray-200 rounded"></div>
            <div className="h-96 bg-gray-200 rounded"></div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">Error loading assignments: {error.message}</p>
        </div>
      </div>
    )
  }

  const getDueDateStatus = (dueDate: string) => {
    const due = new Date(dueDate)
    if (isPast(due)) return { color: 'gray', label: 'Past Due' }
    if (isToday(due)) return { color: 'red', label: 'Due Today' }
    if (isTomorrow(due)) return { color: 'orange', label: 'Due Tomorrow' }
    return { color: 'blue', label: format(due, 'MMM d') }
  }

  const AssignmentCard = ({ assignment, status }: { assignment: any; status: string }) => {
    const dueDateStatus = getDueDateStatus(assignment.due_date)
    const percentage = assignment.submission?.score
      ? (assignment.submission.score / assignment.max_score) * 100
      : null

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 mb-1">{assignment.title}</h3>
            <p className="text-sm text-gray-600">{assignment.subject.name}</p>
          </div>
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            dueDateStatus.color === 'red'
              ? 'bg-red-100 text-red-800'
              : dueDateStatus.color === 'orange'
              ? 'bg-orange-100 text-orange-800'
              : dueDateStatus.color === 'gray'
              ? 'bg-gray-100 text-gray-800'
              : 'bg-blue-100 text-blue-800'
          }`}>
            {dueDateStatus.label}
          </span>
        </div>

        {assignment.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {assignment.description}
          </p>
        )}

        {assignment.attachments && assignment.attachments.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
              <Paperclip className="w-3 h-3" />
              <span>{assignment.attachments.length} attachment{assignment.attachments.length > 1 ? 's' : ''}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-gray-600 mb-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{format(new Date(assignment.due_date), 'MMM d, h:mm a')}</span>
          </div>
          <span className="font-medium">{assignment.max_score} marks</span>
        </div>

        {status === 'graded' && assignment.submission && (
          <div className={`p-3 rounded-lg ${
            percentage && percentage >= 80
              ? 'bg-green-50'
              : percentage && percentage >= 60
              ? 'bg-blue-50'
              : 'bg-orange-50'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Grade</span>
              <span className={`text-lg font-bold ${
                percentage && percentage >= 80
                  ? 'text-green-700'
                  : percentage && percentage >= 60
                  ? 'text-blue-700'
                  : 'text-orange-700'
              }`}>
                {assignment.submission.score}/{assignment.max_score}
              </span>
            </div>
            {percentage && (
              <div className="text-xs text-gray-600">
                {percentage.toFixed(1)}%
              </div>
            )}
            {assignment.submission.feedback && (
              <div className="mt-2 text-xs text-gray-600 italic">
                "{assignment.submission.feedback}"
              </div>
            )}
          </div>
        )}

        {status === 'submitted' && (
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <CheckCircle className="w-4 h-4" />
            <span>Submitted • Awaiting grading</span>
          </div>
        )}

        {status === 'todo' && (
          <button 
            onClick={() => handleOpenSubmission(assignment)}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Submit Assignment
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Assignments</h1>
        <p className="text-gray-600 mt-1">Track your assignments and submissions</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-100 rounded-lg">
              <ClipboardList className="w-5 h-5 text-orange-600" />
            </div>
            <span className="text-gray-600 font-medium">To Do</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {assignments.todo.length}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-gray-600 font-medium">Submitted</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {assignments.submitted.length}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <Award className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-gray-600 font-medium">Graded</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {assignments.graded.length}
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* To Do Column */}
        <div>
          <div className="bg-orange-600 text-white rounded-t-xl p-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              <h2 className="font-bold text-lg">To Do</h2>
              <span className="ml-auto bg-orange-700 px-2 py-1 rounded text-sm">
                {assignments.todo.length}
              </span>
            </div>
          </div>
          <div className="bg-gray-50 rounded-b-xl p-4 space-y-3 min-h-[400px]">
            {assignments.todo.length > 0 ? (
              assignments.todo.map((assignment: any) => (
                <AssignmentCard key={assignment.id} assignment={assignment} status="todo" />
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No pending assignments</p>
              </div>
            )}
          </div>
        </div>

        {/* Submitted Column */}
        <div>
          <div className="bg-blue-600 text-white rounded-t-xl p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <h2 className="font-bold text-lg">Submitted</h2>
              <span className="ml-auto bg-blue-700 px-2 py-1 rounded text-sm">
                {assignments.submitted.length}
              </span>
            </div>
          </div>
          <div className="bg-gray-50 rounded-b-xl p-4 space-y-3 min-h-[400px]">
            {assignments.submitted.length > 0 ? (
              assignments.submitted.map((assignment: any) => (
                <AssignmentCard key={assignment.id} assignment={assignment} status="submitted" />
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No submitted assignments</p>
              </div>
            )}
          </div>
        </div>

        {/* Graded Column */}
        <div>
          <div className="bg-green-600 text-white rounded-t-xl p-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              <h2 className="font-bold text-lg">Graded</h2>
              <span className="ml-auto bg-green-700 px-2 py-1 rounded text-sm">
                {assignments.graded.length}
              </span>
            </div>
          </div>
          <div className="bg-gray-50 rounded-b-xl p-4 space-y-3 min-h-[400px]">
            {assignments.graded.length > 0 ? (
              assignments.graded.map((assignment: any) => (
                <AssignmentCard key={assignment.id} assignment={assignment} status="graded" />
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Award className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No graded assignments yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Submission Dialog */}
      {submissionDialog.open && submissionDialog.assignment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Submit Assignment</h2>
                <p className="text-sm text-gray-600 mt-1">{submissionDialog.assignment.title}</p>
              </div>
              <button
                onClick={handleCloseSubmission}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Assignment Details */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Subject</span>
                  <span className="text-sm text-gray-900">{submissionDialog.assignment.subject.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Due Date</span>
                  <span className="text-sm text-gray-900">
                    {format(new Date(submissionDialog.assignment.due_date), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Max Score</span>
                  <span className="text-sm text-gray-900">{submissionDialog.assignment.max_score} marks</span>
                </div>
              </div>

              {submissionDialog.assignment.description && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assignment Description
                  </label>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                    {submissionDialog.assignment.description}
                  </div>
                </div>
              )}

              {submissionDialog.assignment.instructions && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Instructions
                  </label>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                    {submissionDialog.assignment.instructions}
                  </div>
                </div>
              )}

              {/* Teacher Attachments */}
              {submissionDialog.assignment.attachments && submissionDialog.assignment.attachments.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Teacher's Materials
                  </label>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-2">
                    {submissionDialog.assignment.attachments.map((attachmentUrl: string, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-purple-100 hover:shadow-sm transition-shadow">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="w-5 h-5 text-purple-600 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-700 truncate">
                            {getFileName(attachmentUrl)}
                          </span>
                        </div>
                        <a
                          href={attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="ml-3 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium flex items-center gap-2 transition-colors flex-shrink-0"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </a>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Click download to save the files to your device
                  </p>
                </div>
              )}

              {/* Submission Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Submission <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  placeholder="Enter your assignment submission here..."
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* File Attachments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Attach Files (Optional)
                </label>
                <div className="space-y-3">
                  {/* File Input */}
                  <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer">
                    <input
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.zip"
                    />
                    <div className="flex items-center gap-2 text-gray-600">
                      <Upload className="w-5 h-5" />
                      <span className="text-sm font-medium">Click to upload files</span>
                    </div>
                  </label>

                  {/* Attached Files List */}
                  {attachedFiles.length > 0 && (
                    <div className="space-y-2">
                      {attachedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                              <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveFile(index)}
                            className="ml-2 p-1 hover:bg-red-100 rounded transition-colors flex-shrink-0"
                          >
                            <X className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Supported formats: PDF, DOC, DOCX, TXT, JPG, PNG, ZIP (Max 10MB per file)
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6">
              {/* Upload Progress */}
              {isSubmitting && uploadProgress > 0 && uploadProgress < 100 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                    <span>Uploading files...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={handleCloseSubmission}
                  disabled={isSubmitting}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !submissionText.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {uploadProgress > 0 ? `Uploading... ${uploadProgress}%` : 'Submitting...'}
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Assignment
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
