'use client'

'use client'

import { useState } from 'react'
import { useStudentCourses } from '@/hooks/useStudentDashboard'
import { CalendarDays, Loader2, AlertCircle } from 'lucide-react'

export default function StudentCoursesPage() {
  const { courses, isLoading, error } = useStudentCourses()
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [selectedCoursePeriodId, setSelectedCoursePeriodId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="border border-red-200 bg-red-50 dark:bg-red-950/20 rounded-md p-6 flex items-center gap-4">
          <AlertCircle className="h-8 w-8 text-red-600 shrink-0" />
          <div>
            <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading courses</h3>
            <p className="text-red-700 dark:text-red-300 text-sm">{error.message}</p>
          </div>
        </div>
      </div>
    )
  }

  // Find the selected subject/course from the flat list
  const selectedSubject = courses.find(c => c.subject_id === selectedSubjectId)
  const selectedCourse = courses.find(c => c.subject_id === selectedCourseId)

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b pb-4">
        <CalendarDays className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-bold">Courses</h1>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center text-sm text-muted-foreground">
        <span>Courses</span>
      </div>

      {/* ── Top Details Panel ────────────────────────────────────── */}
      {(selectedSubject || selectedCourse || selectedCoursePeriodId) && (
        <div className="bg-background border border-border rounded-md overflow-hidden mb-4 shadow-sm">
          <div className="px-4 py-3 bg-muted/20 border-b">
            <h2 className="text-lg font-semibold text-primary">
              {selectedCoursePeriodId 
                ? `${selectedCourse?.subject_name} - ${selectedCourse?.teacher_name || 'Unassigned'}`
                : selectedCourse 
                  ? selectedCourse.subject_name 
                  : selectedSubject?.subject_name}
            </h2>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            {selectedCoursePeriodId ? (
              // Course Period Details
              <>
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold tracking-wider mb-1">Title</p>
                  <p className="font-medium">{selectedCourse?.subject_name} - {selectedCourse?.teacher_name || 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold tracking-wider mb-1">Teacher</p>
                  <p className="font-medium">{selectedCourse?.teacher_name || 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold tracking-wider mb-1">Enrollment Status</p>
                  <p className="font-medium text-emerald-600">Enrolled Active</p>
                </div>
              </>
            ) : (
              // Subject / Course Details
              <>
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold tracking-wider mb-1">Title</p>
                  <p className="font-medium">{selectedCourse ? selectedCourse.subject_name : selectedSubject?.subject_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold tracking-wider mb-1">Short Name</p>
                  <p className="font-medium">{selectedCourse ? selectedCourse.subject_code || '—' : selectedSubject?.subject_code || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold tracking-wider mb-1">Teacher</p>
                  <p className="font-medium">{selectedCourse ? selectedCourse.teacher_name || 'Unassigned' : '—'}</p>
                </div>
                
                {/* Description row spanning full width if available */}
                {selectedCourse?.description && (
                  <div className="md:col-span-3 pt-2 border-t mt-2">
                    <p className="text-muted-foreground text-xs uppercase font-semibold tracking-wider mb-1">Description</p>
                    <p className="text-foreground/80">{selectedCourse.description}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Admin-style 3-Panel Layout */}
      <div className="flex gap-0 border rounded-md overflow-hidden min-h-[500px]">
        
        {/* ── Panel 1: Subjects ──────────────────────────────────── */}
        <div className="min-w-50 max-w-62.5 border-r bg-background">
          <div className="px-3 py-2 text-xs text-muted-foreground border-b">
            {courses.length} subject{courses.length !== 1 ? 's' : ''} found.
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-teal-700">
                  Subject
                </th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {courses.map((sub) => (
                <tr
                  key={sub.subject_id}
                  className={`border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                    selectedSubjectId === sub.subject_id ? "bg-primary/10 font-medium" : ""
                  }`}
                  onClick={() => {
                    setSelectedSubjectId(sub.subject_id)
                    setSelectedCourseId(null)
                    setSelectedCoursePeriodId(null)
                  }}
                >
                  <td className="px-3 py-2 text-primary hover:underline">
                    {sub.subject_name}
                  </td>
                  <td className="px-1 py-2 text-right">
                    {/* Read-only: no action buttons */}
                  </td>
                </tr>
              ))}
              {courses.length === 0 && (
                <tr className="border-b">
                  <td colSpan={2} className="px-3 py-4 text-muted-foreground">
                    No subjects found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Panel 2: Courses ───────────────────────────────────── */}
        {selectedSubjectId ? (
          <div className="min-w-50 max-w-62.5 border-r bg-background">
            <div className="px-3 py-2 text-xs text-muted-foreground border-b">
              1 course found.
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-teal-700">
                    Course
                  </th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                {selectedSubject && (
                  <tr
                    className={`border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedCourseId === selectedSubject.subject_id ? "bg-primary/10 font-medium" : ""
                    }`}
                    onClick={() => {
                      setSelectedCourseId(selectedSubject.subject_id)
                      setSelectedCoursePeriodId(null)
                    }}
                  >
                    <td className="px-3 py-2 text-primary hover:underline">
                      {selectedSubject.subject_name}
                    </td>
                    <td className="px-1 py-2 text-right">
                      {/* Read-only: no action buttons */}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-1 bg-background flex items-center justify-center text-sm text-muted-foreground">
            Select a subject to view its courses
          </div>
        )}

        {/* ── Panel 3: Course Periods ────────────────────────────── */}
        {selectedCourseId && selectedCourse ? (
          <div className="flex-1 bg-background">
            <div className="px-3 py-2 text-xs text-muted-foreground border-b">
              1 course period found.
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-teal-700">
                    Course Period
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-teal-700">
                    Available Seats
                  </th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  className={`border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                    selectedCoursePeriodId === selectedCourse.subject_id ? "bg-primary/10 font-medium" : ""
                  }`}
                  onClick={() => setSelectedCoursePeriodId(selectedCourse.subject_id)}
                >
                  <td className="px-3 py-2 text-primary">
                    {selectedCourse.subject_name} - {selectedCourse.teacher_name || 'Unassigned'}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-amber-600">
                    —
                  </td>
                  <td className="px-1 py-2 text-right">
                    {/* Read-only: no action buttons */}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : selectedSubjectId ? (
          <div className="flex-1 bg-background" />
        ) : null}

      </div>
    </div>
  )
}
