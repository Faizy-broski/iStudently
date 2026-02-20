"use client"

import { useState } from "react"
import useSWR from "swr"
import { useCampus } from "@/context/CampusContext"
import { getSubjects } from "@/lib/api/academics"
import { getCourses } from "@/lib/api/grades"
import {
  createScheduleRequest,
  deleteScheduleRequest,
  getScheduleRequests,
} from "@/lib/api/schedule-requests"
import { Plus, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

interface SelectedStudent {
  id: string
  name: string
  student_number: string
  grade_level?: string | null
}

interface StudentRequestsProps {
  student: SelectedStudent
  academicYearId: string
  onRequestCreated: () => void
}

interface Subject {
  id: string
  name: string
}

interface Course {
  id: string
  title: string
  subject_id?: string | null
}

export function StudentRequests({
  student,
  academicYearId,
  onRequestCreated,
}: StudentRequestsProps) {
  const campusContext = useCampus()
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>("all")
  const [courseTitleSearch, setCourseTitleSearch] = useState("")
  const [saving, setSaving] = useState(false)

  // Fetch all requests for this student
  const {
    data: requests,
    isLoading: requestsLoading,
    mutate: mutateRequests,
  } = useSWR(
    ["student-all-requests", student.id, academicYearId],
    async () => {
      return getScheduleRequests(academicYearId, {
        student_id: student.id,
        campus_id: campusContext?.selectedCampus?.id,
      })
    },
    { revalidateOnFocus: false }
  )

  // Fetch subjects for filter dropdown
  const { data: subjectsData } = useSWR(
    ["subjects-for-requests"],
    async () => {
      const response = await getSubjects()
      if (!response.success) throw new Error(response.error || "Failed")
      return response.data || []
    },
    { revalidateOnFocus: false }
  )

  // Fetch courses for adding requests
  const { data: coursesData } = useSWR(
    ["courses-for-requests", campusContext?.selectedCampus?.id],
    async () => {
      const response = await getCourses(campusContext?.selectedCampus?.id)
      if (!response.success) throw new Error(response.error || "Failed")
      return response.data || []
    },
    { revalidateOnFocus: false }
  )

  const subjects: Subject[] = (subjectsData || []) as Subject[]
  const allCourses: Course[] = (coursesData || []) as Course[]
  const allRequests = requests || []

  // Filter courses based on subject + title search
  const filteredCourses = allCourses.filter((c) => {
    if (selectedSubjectFilter !== "all" && c.subject_id !== selectedSubjectFilter) return false
    if (courseTitleSearch.trim()) {
      return c.title.toLowerCase().includes(courseTitleSearch.toLowerCase())
    }
    return true
  })

  const handleAddRequest = async (courseId: string) => {
    setSaving(true)
    try {
      await createScheduleRequest({
        student_id: student.id,
        course_id: courseId,
        academic_year_id: academicYearId,
        campus_id: campusContext?.selectedCampus?.id,
      })
      toast.success("Course request added")
      mutateRequests()
      onRequestCreated()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add request")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRequest = async (requestId: string) => {
    try {
      await deleteScheduleRequest(requestId)
      toast.success("Request removed")
      mutateRequests()
      onRequestCreated()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to remove request")
    }
  }

  return (
    <div className="border-t pt-4 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-amber-500" />
        <h2 className="text-xl font-bold">Student Requests</h2>
      </div>

      {/* Existing requests */}
      {allRequests.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">
            {allRequests.length} request{allRequests.length !== 1 ? "s" : ""} found.
          </p>
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left px-4 py-2 font-semibold text-primary uppercase text-xs">
                    Course
                  </th>
                  <th className="text-left px-4 py-2 font-semibold text-primary uppercase text-xs">
                    Status
                  </th>
                  <th className="text-left px-4 py-2 font-semibold text-primary uppercase text-xs">
                    Priority
                  </th>
                  <th className="text-right px-4 py-2 font-semibold text-primary uppercase text-xs">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {allRequests.map((req) => (
                  <tr key={req.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2">{req.course?.title || "—"}</td>
                    <td className="px-4 py-2 capitalize">{req.status}</td>
                    <td className="px-4 py-2">{req.priority}</td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive h-7 text-xs"
                        onClick={() => handleDeleteRequest(req.id)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {allRequests.length === 0 && !requestsLoading && (
        <p className="text-sm font-semibold">No requests were found.</p>
      )}

      {/* Add request form */}
      <div className="flex items-center justify-end">
        <Button variant="default" size="sm" disabled={saving}>
          SAVE
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          <Select
            value={selectedSubjectFilter}
            onValueChange={setSelectedSubjectFilter}
          >
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm">Course Title</span>
          <Input
            value={courseTitleSearch}
            onChange={(e) => setCourseTitleSearch(e.target.value)}
            placeholder=""
            className="w-48 h-8"
          />
        </div>
      </div>

      {/* Matching courses to add as requests */}
      {(selectedSubjectFilter !== "all" || courseTitleSearch.trim()) && (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-2 font-semibold text-primary uppercase text-xs">
                  Course
                </th>
                <th className="text-right px-4 py-2 font-semibold text-primary uppercase text-xs">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCourses.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-4 text-center text-muted-foreground text-xs">
                    No matching courses found
                  </td>
                </tr>
              ) : (
                filteredCourses.map((course) => {
                  const alreadyRequested = allRequests.some(
                    (r) => r.course_id === course.id
                  )
                  return (
                    <tr key={course.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2">{course.title}</td>
                      <td className="px-4 py-2 text-right">
                        {alreadyRequested ? (
                          <span className="text-xs text-muted-foreground">Already requested</span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={saving}
                            onClick={() => handleAddRequest(course.id)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Request
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Bottom save button */}
      <div className="flex justify-center">
        <Button onClick={() => toast.info("Requests saved")} disabled={saving}>
          SAVE
        </Button>
      </div>
    </div>
  )
}
