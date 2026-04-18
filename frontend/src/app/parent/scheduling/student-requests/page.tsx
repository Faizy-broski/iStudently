"use client"

// Parent: Student Requests — parent can manage course requests for their child.
// Uses the same StudentScheduleList to pick a child, then shows StudentRequests inline.
import { useState } from "react"
import { StudentScheduleList } from "@/components/scheduling/StudentScheduleList"
import { StudentScheduleDetail } from "@/components/scheduling/StudentScheduleDetail"

interface SelectedStudent {
  id: string
  name: string
  student_number: string
  grade_level?: string | null
}

export default function ParentStudentRequestsPage() {
  const [selectedStudent, setSelectedStudent] = useState<SelectedStudent | null>(null)

  // Reuse the same schedule detail view — it includes the StudentRequests panel at the bottom
  if (selectedStudent) {
    return (
      <StudentScheduleDetail
        student={selectedStudent}
        onBack={() => setSelectedStudent(null)}
      />
    )
  }

  return <StudentScheduleList onSelectStudent={setSelectedStudent} />
}
