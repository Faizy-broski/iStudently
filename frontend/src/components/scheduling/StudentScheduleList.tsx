"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import { useAuth } from "@/context/AuthContext"
import { useCampus } from "@/context/CampusContext"
import * as studentsApi from "@/lib/api/students"
import { Search, Download, CalendarDays } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

interface SelectedStudent {
  id: string
  name: string
  student_number: string
  grade_level?: string | null
}

interface StudentScheduleListProps {
  onSelectStudent: (student: SelectedStudent) => void
}

export function StudentScheduleList({ onSelectStudent }: StudentScheduleListProps) {
  const { user } = useAuth()
  const campusContext = useCampus()
  const [search, setSearch] = useState("")

  const cacheKey = user
    ? ["students-schedule-list", user.id, campusContext?.selectedCampus?.id]
    : null

  const { data, isLoading } = useSWR(cacheKey, async () => {
    const response = await studentsApi.getStudents({
      limit: 1000,
      campus_id: campusContext?.selectedCampus?.id,
    })
    if (!response.success) throw new Error(response.error || "Failed to fetch students")
    return response.data || []
  }, {
    dedupingInterval: 10000,
    revalidateOnFocus: false,
    keepPreviousData: true,
  })

  const filteredStudents = useMemo(() => {
    const students = data || []
    if (!search.trim()) return students
    const q = search.toLowerCase()
    return students.filter((s) => {
      const name = [
        s.profile?.first_name,
        s.profile?.father_name,
        s.profile?.last_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return (
        name.includes(q) ||
        s.student_number.toLowerCase().includes(q) ||
        (s.grade_level || "").toLowerCase().includes(q)
      )
    })
  }, [data, search])

  const handleSelectStudent = (student: studentsApi.Student) => {
    const name = [
      student.profile?.first_name,
      student.profile?.father_name,
      student.profile?.last_name,
    ]
      .filter(Boolean)
      .join(" ")

    onSelectStudent({
      id: student.id,
      name,
      student_number: student.student_number,
      grade_level: student.grade_level,
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b pb-4">
        <CalendarDays className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-bold">Student Schedule</h1>
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""} were found.</span>
          <button
            className="text-muted-foreground hover:text-foreground"
            title="Download"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
        <div className="relative w-64">
          <Input
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-8"
          />
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  Student
                </th>
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  Student Number
                </th>
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  Grade Level
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                    No students found.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, idx) => {
                  const name = [
                    student.profile?.first_name,
                    student.profile?.father_name,
                    student.profile?.last_name,
                  ]
                    .filter(Boolean)
                    .join(" ")

                  return (
                    <tr
                      key={student.id}
                      className={`border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors ${
                        idx % 2 === 0 ? "bg-background" : "bg-muted/20"
                      }`}
                      onClick={() => handleSelectStudent(student)}
                    >
                      <td className="px-4 py-3">
                        <button
                          className="text-primary hover:underline font-medium text-left"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSelectStudent(student)
                          }}
                        >
                          {name || "—"}
                        </button>
                      </td>
                      <td className="px-4 py-3">{student.student_number}</td>
                      <td className="px-4 py-3">{student.grade_level || "—"}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
