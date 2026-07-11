"use client"

import { GrievanceList } from "@/components/grievances/GrievanceList"

export default function TeacherGrievancesPage() {
  return (
    <div className="p-6">
      <GrievanceList detailHrefBase="/teacher/grievances" submitHref="/teacher/grievances/submit" />
    </div>
  )
}
