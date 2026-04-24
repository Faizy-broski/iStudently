"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { useParentDashboard } from "@/context/ParentDashboardContext"
import { getStudentGrades, getMarkingPeriods, type StudentFinalGradeEntry, type MarkingPeriodOption } from "@/lib/api/grades"
import { GraduationCap, Loader2, Search } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function ParentStudentGradesPage() {
  const { selectedStudent, selectedStudentData, isLoading: studentLoading } = useParentDashboard()

  const campusId = selectedStudentData?.campus_id
  const [selectedMp, setSelectedMp] = useState<string>("all")
  const [search, setSearch] = useState("")

  const { data: mpRes } = useSWR(
    campusId ? ["parent-sg-mps", campusId] : null,
    () => getMarkingPeriods(campusId),
    { revalidateOnFocus: false }
  )
  const markingPeriods: MarkingPeriodOption[] = mpRes?.data || []

  const { data: gradesRes, isLoading: gradesLoading } = useSWR(
    selectedStudent ? ["parent-sg-grades", selectedStudent, selectedMp, campusId] : null,
    () => getStudentGrades({
      student_id: selectedStudent!,
      marking_period_id: selectedMp !== "all" ? selectedMp : undefined,
      campus_id: campusId,
    }),
    { revalidateOnFocus: false }
  )
  const grades: StudentFinalGradeEntry[] = gradesRes?.data || []

  const filtered = search.trim()
    ? grades.filter((g) =>
        g.course_title.toLowerCase().includes(search.toLowerCase()) ||
        (g.teacher_name || "").toLowerCase().includes(search.toLowerCase())
      )
    : grades

  if (studentLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!selectedStudent || !selectedStudentData) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Select a child to view their grades.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent flex items-center gap-2">
          <GraduationCap className="h-8 w-8 text-[#57A3CC]" />
          Student Grades
        </h1>
        <p className="text-muted-foreground mt-2">
          {selectedStudentData.first_name} {selectedStudentData.last_name}
          <span className="ml-1 font-medium">— {selectedStudentData.campus_name}</span>
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <Select value={selectedMp} onValueChange={setSelectedMp}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Marking Periods" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Marking Periods</SelectItem>
            {markingPeriods.map((mp) => (
              <SelectItem key={mp.id} value={mp.id}>{mp.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative w-64">
          <Input
            placeholder="Search course or teacher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-8"
          />
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
        <span className="text-sm text-[#0369a1] font-medium">
          {filtered.length} course{filtered.length !== 1 ? "s" : ""} found.
        </span>
      </div>

      {/* Grades Table */}
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#0369a1] hover:bg-[#0369a1]">
              <TableHead className="text-white font-semibold">COURSE</TableHead>
              <TableHead className="text-white font-semibold">TEACHER</TableHead>
              <TableHead className="text-white font-semibold text-right">%</TableHead>
              <TableHead className="text-white font-semibold">GRADE</TableHead>
              <TableHead className="text-white font-semibold text-right">GPA POINTS</TableHead>
              <TableHead className="text-white font-semibold">COMMENT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gradesLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}><Skeleton className="h-5 w-full" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  No grades found for the selected period.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((g, idx) => (
                <TableRow key={g.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <TableCell className="font-medium">{g.course_title}</TableCell>
                  <TableCell>{g.teacher_name || "—"}</TableCell>
                  <TableCell className="text-right">
                    {g.percent_grade != null ? `${g.percent_grade.toFixed(1)}%` : "—"}
                  </TableCell>
                  <TableCell>
                    {g.letter_grade ? (
                      <span className="font-semibold text-primary">{g.letter_grade}</span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {g.grade_points != null ? g.grade_points.toFixed(2) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {g.comment || "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
