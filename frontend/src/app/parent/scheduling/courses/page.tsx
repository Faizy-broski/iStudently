"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import { useParentDashboard } from "@/context/ParentDashboardContext"
import { getParentStudentCourses, type ParentStudentCourse } from "@/lib/api/parent-dashboard"
import { CalendarDays, Loader2, GraduationCap } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function ParentCoursesPage() {
  const { selectedStudent, selectedStudentData, isLoading: studentsLoading } = useParentDashboard()

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)

  const { data: courses = [], isLoading: coursesLoading } = useSWR(
    selectedStudent ? ["parent-student-courses", selectedStudent] : null,
    () => getParentStudentCourses(selectedStudent!),
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  )

  const selectedCourse: ParentStudentCourse | undefined = useMemo(
    () => courses.find((c) => c.subject_id === selectedSubjectId),
    [courses, selectedSubjectId]
  )

  if (studentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!selectedStudentData) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Select a child to view their courses.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b pb-4">
        <CalendarDays className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-bold">Courses</h1>
        <span className="text-lg text-muted-foreground">
          — {selectedStudentData.first_name} {selectedStudentData.last_name}
        </span>
      </div>

      {/* Detail panel */}
      {selectedCourse && (
        <div className="bg-background border rounded-md overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-muted/20 border-b">
            <h2 className="text-lg font-semibold text-primary">{selectedCourse.subject_name}</h2>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold tracking-wider mb-1">Subject</p>
              <p className="font-medium">{selectedCourse.subject_name}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold tracking-wider mb-1">Code</p>
              <p className="font-medium">{selectedCourse.subject_code || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase font-semibold tracking-wider mb-1">Teacher</p>
              <p className="font-medium">{selectedCourse.teacher_name || "Unassigned"}</p>
            </div>
          </div>
        </div>
      )}

      {/* 2-panel layout */}
      <div className="flex gap-0 border rounded-md overflow-hidden min-h-125">

        {/* Panel 1: Subjects */}
        <div className="min-w-50 max-w-62.5 border-r bg-background">
          <div className="px-3 py-2 text-xs text-muted-foreground border-b">
            {coursesLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              <>{courses.length} subject{courses.length !== 1 ? "s" : ""} found.</>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-teal-700">Subject</th>
              </tr>
            </thead>
            <tbody>
              {coursesLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-3 py-2"><Skeleton className="h-4 w-full" /></td>
                  </tr>
                ))
              ) : courses.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-xs text-muted-foreground text-center">
                    No enrolled subjects
                  </td>
                </tr>
              ) : (
                courses.map((sub) => (
                  <tr
                    key={sub.subject_id}
                    className={`border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedSubjectId === sub.subject_id ? "bg-primary/10 font-medium" : ""
                    }`}
                    onClick={() => setSelectedSubjectId((prev) => prev === sub.subject_id ? null : sub.subject_id)}
                  >
                    <td className="px-3 py-2 text-primary hover:underline">{sub.subject_name}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Panel 2: Course detail or prompt */}
        {selectedCourse ? (
          <div className="flex-1 bg-background">
            <div className="px-3 py-2 text-xs text-muted-foreground border-b">
              1 course found.
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-teal-700">Course</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-teal-700">Teacher</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-teal-700">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-muted/30">
                  <td className="px-3 py-2 text-primary font-medium">{selectedCourse.subject_name}</td>
                  <td className="px-3 py-2">{selectedCourse.teacher_name || "Unassigned"}</td>
                  <td className="px-3 py-2">
                    <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      Enrolled
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-8 bg-muted/10">
            Select a subject to view its details
          </div>
        )}

      </div>
    </div>
  )
}
