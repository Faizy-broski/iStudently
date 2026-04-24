'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useStudentAssignments } from '@/hooks/useStudentDashboard'
import { submitAssignment } from '@/lib/api/student-dashboard'
import { uploadStudentSubmissionFiles } from '@/lib/api/storage'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { format, parseISO } from 'date-fns'
import { Loader2, Upload, FileText, X, ArrowLeft, Check } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

function formatDate(d?: string | null) {
  if (!d) return '—'
  try { return format(parseISO(d), 'MMMM d yyyy') } catch { return d }
}

function teacherName(teacher: any) {
  if (!teacher?.profile) return '—'
  const p = teacher.profile
  return `${p.first_name || ''} ${p.last_name || ''}`.trim() || '—'
}

export default function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { profile } = useAuth()
  const campusCtx = useCampus()
  const campusId = campusCtx?.selectedCampus?.id || profile?.campus_id

  const { assignments, isLoading, error, refresh } = useStudentAssignments()

  const [submissionText, setSubmissionText] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const assignment = [
    ...assignments.todo,
    ...assignments.submitted,
    ...assignments.graded,
  ].find(a => a.id === id)

  // Prefill submission text if already submitted
  useEffect(() => {
    if (assignment?.submission?.submission_text) {
      setSubmissionText(assignment.submission.submission_text)
    }
  }, [assignment?.id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[#4A90E2]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700 text-sm">
          Error loading assignments: {error.message}
        </div>
      </div>
    )
  }

  if (!assignment) {
    return (
      <div className="p-6">
        <div className="text-gray-500 text-sm">Assignment not found.</div>
      </div>
    )
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const valid = Array.from(e.target.files).filter(f => {
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name} exceeds 10 MB`); return false }
      return true
    })
    setAttachedFiles(prev => [...prev, ...valid])
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      let attachments: { url: string; name: string; uploaded_at: string }[] = []

      if (attachedFiles.length > 0 && profile?.id && profile?.school_id && profile?.campus_id) {
        toast.info('Uploading files…')
        const up = await uploadStudentSubmissionFiles(
          attachedFiles,
          profile.id,
          assignment.id,
          profile.school_id,
          profile.campus_id
        )
        if (!up.success || !up.urls) {
          toast.error(up.error || 'Upload failed')
          setIsSubmitting(false)
          return
        }
        attachments = up.urls.map((url: string, i: number) => ({
          url,
          name: attachedFiles[i]?.name || 'file',
          uploaded_at: new Date().toISOString(),
        }))
      }

      const result = await submitAssignment({
        assignment_id: assignment.id,
        submission_text: submissionText,
        attachments,
      })

      if (result.success) {
        toast.success('Assignment submitted!')
        refresh()
        router.push('/student/assignments')
      } else {
        toast.error(result.error || 'Submission failed')
      }
    } catch (err: any) {
      toast.error(err.message || 'Submission failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isGraded = assignment.submission?.status === 'graded'
  const isSubmitted = !!assignment.submission

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/student/assignments"
        className="inline-flex items-center gap-1.5 text-[#4A90E2] text-sm hover:underline mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Assignments
      </Link>

      <div className="bg-white border border-gray-200 rounded shadow-sm">

        {/* Metadata table */}
        <div className="border-b border-gray-200">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="px-6 py-3 text-gray-500 w-1/4">Due Date</td>
                <td className="px-6 py-3 font-medium text-gray-800 w-1/4">{formatDate(assignment.due_date)}</td>
                <td className="px-6 py-3 text-gray-500 w-1/4">Assigned Date</td>
                <td className="px-6 py-3 font-medium text-gray-800 w-1/4">{formatDate(assignment.assigned_date)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-6 py-3 text-gray-500">Course Title</td>
                <td className="px-6 py-3 font-medium text-gray-800">{assignment.subject?.name || '—'}</td>
                <td className="px-6 py-3 text-gray-500">Teacher</td>
                <td className="px-6 py-3 font-medium text-gray-800">{teacherName(assignment.teacher)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-6 py-3 text-gray-500">Title</td>
                <td className="px-6 py-3 font-medium text-gray-800">{assignment.title}</td>
                <td className="px-6 py-3 text-gray-500">Category</td>
                <td className="px-6 py-3 font-medium text-gray-800">{assignment.assignment_type?.title || '—'}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-gray-500">Points</td>
                <td className="px-6 py-3 font-medium text-gray-800">{assignment.max_score}</td>
                <td className="px-6 py-3 text-gray-500">Status</td>
                <td className="px-6 py-3">
                  {isGraded ? (
                    <span className="text-green-600 font-medium">
                      Graded — {assignment.submission.marks_obtained}/{assignment.max_score}
                    </span>
                  ) : isSubmitted ? (
                    <span className="text-blue-600 font-medium flex items-center gap-1">
                      <Check className="h-4 w-4" /> Submitted
                    </span>
                  ) : (
                    <span className="text-orange-600 font-medium">Pending</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Description */}
        {assignment.description && (
          <div
            className="px-6 py-5 border-b border-gray-100 prose prose-sm max-w-none text-gray-700"
            dangerouslySetInnerHTML={{ __html: assignment.description }}
          />
        )}

        {/* Teacher file attachment */}
        {assignment.file_url && (
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#4A90E2]" />
            <a
              href={assignment.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#4A90E2] text-sm hover:underline"
            >
              Download attachment
            </a>
          </div>
        )}

        {/* Graded feedback */}
        {isGraded && assignment.submission?.feedback && (
          <div className="px-6 py-4 border-b border-gray-100 bg-green-50">
            <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Teacher Feedback</p>
            <p className="text-sm text-gray-700 italic">"{assignment.submission.feedback}"</p>
          </div>
        )}

        {/* Submission form */}
        {assignment.enable_submission && !isGraded ? (
          <div className="px-6 py-5 space-y-5">
            {/* File upload */}
            <div>
              <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wide font-medium">Files</label>
              <label className="flex items-center gap-2 cursor-pointer border border-gray-300 rounded px-3 py-2 text-sm text-gray-600 bg-white hover:bg-gray-50 w-fit">
                <Upload className="h-4 w-4" />
                <span>{attachedFiles.length > 0 ? `${attachedFiles.length} file(s) selected` : 'No file chosen'}</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.zip"
                  onChange={handleFileChange}
                />
              </label>
              {attachedFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {attachedFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                      <FileText className="h-3 w-3" />
                      <span>{f.name}</span>
                      <button onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))}>
                        <X className="h-3 w-3 text-red-400 hover:text-red-600" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Show previously submitted files */}
              {isSubmitted && assignment.submission?.attachments?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-1">Previously submitted files:</p>
                  {assignment.submission.attachments.map((att: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                      <FileText className="h-3 w-3 text-[#4A90E2]" />
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-[#4A90E2] hover:underline">
                        {att.name}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rich text editor */}
            <div>
              <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wide font-medium">Message</label>
              <RichTextEditor
                value={submissionText}
                onChange={setSubmissionText}
                placeholder="Write your answer or message to the teacher…"
                campusId={campusId}
              />
            </div>

            {/* Submit button */}
            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2 bg-[#4A90E2] text-white text-sm font-semibold rounded hover:bg-[#357ABD] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 uppercase tracking-wide"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitted ? 'Resubmit Assignment' : 'Submit Assignment'}
              </button>
            </div>
          </div>
        ) : !assignment.enable_submission ? (
          <div className="px-6 py-4 text-sm text-gray-400 italic">
            No submission required for this assignment.
          </div>
        ) : null}
      </div>
    </div>
  )
}
