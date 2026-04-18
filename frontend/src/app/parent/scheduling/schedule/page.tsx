"use client"

// Parent: Schedule — parent sees their child's schedule.
// Uses the same StudentScheduleList/Detail components; the parent selects their child.
import { useState } from "react"
import { StudentScheduleList } from "@/components/scheduling/StudentScheduleList"
import { StudentScheduleDetail } from "@/components/scheduling/StudentScheduleDetail"

interface SelectedStudent {
  id: string
  name: string
  student_number: string
  grade_level?: string | null
}

export default function ParentSchedulePage() {
  const [selectedStudent, setSelectedStudent] = useState<SelectedStudent | null>(null)

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
