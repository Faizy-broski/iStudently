'use client'

import { useParams } from 'next/navigation'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { useParentStudentAssignments } from '@/hooks/useParentDashboard'
import { format, parseISO } from 'date-fns'
import { Loader2, FileText, ArrowLeft, Check } from 'lucide-react'
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

export default function ParentAssignmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  
  const { selectedStudentData, isLoading: studentLoading } = useParentDashboard()
  const { assignments, isLoading, error } = useParentStudentAssignments()

  const assignment = [
    ...assignments.todo,
    ...assignments.submitted,
    ...assignments.graded,
  ].find(a => a.id === id)

  if (studentLoading || isLoading) {
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
          Error loading assignment: {error.message}
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

  const isGraded = assignment.submission?.status === 'graded'
  const isSubmitted = !!assignment.submission

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/parent/grades/student-assignments"
        className="inline-flex items-center gap-1.5 text-[#4A90E2] text-sm hover:underline mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Assignments
      </Link>
      
      {selectedStudentData && (
        <div className="mb-4">
          <p className="text-muted-foreground text-sm">
            Viewing assignment for <span className="font-semibold text-gray-700">{selectedStudentData.first_name} {selectedStudentData.last_name}</span>
          </p>
        </div>
      )}

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
                <td className="px-6 py-3 font-medium text-gray-800">{(assignment as any).assignment_type?.title || '—'}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-gray-500">Points</td>
                <td className="px-6 py-3 font-medium text-gray-800">{assignment.max_score}</td>
                <td className="px-6 py-3 text-gray-500">Status</td>
                <td className="px-6 py-3">
                  {isGraded ? (
                    <span className="text-green-600 font-medium">
                      Graded — {assignment.submission?.marks_obtained}/{assignment.max_score}
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
        {(assignment as any).file_url && (
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#4A90E2]" />
            <a
              href={(assignment as any).file_url}
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

        {/* Student Submission (Read-Only) */}
        {isSubmitted && (
          <div className="px-6 py-5 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-800 mb-4 border-b pb-2">Student's Submission</h3>
            
            {/* Submission Files */}
            {(assignment.submission as any)?.attachments?.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide font-medium">Attached Files</p>
                <div className="space-y-1">
                  {(assignment.submission as any).attachments.map((att: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                      <FileText className="h-3 w-3 text-[#4A90E2]" />
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-[#4A90E2] hover:underline">
                        {att.name}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submission Text */}
            {(assignment.submission as any)?.submission_text && (
              <div>
                <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide font-medium">Message/Answer</p>
                <div 
                  className="bg-white p-4 border border-gray-200 rounded text-sm text-gray-700 prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: (assignment.submission as any).submission_text }}
                />
              </div>
            )}

            {!((assignment.submission as any)?.attachments?.length > 0) && !((assignment.submission as any)?.submission_text) && (
               <p className="text-sm text-gray-500 italic">No text or files submitted.</p>
            )}
            
            <p className="text-xs text-gray-400 mt-4">
              Submitted on: {formatDate(assignment.submission?.submitted_at)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
