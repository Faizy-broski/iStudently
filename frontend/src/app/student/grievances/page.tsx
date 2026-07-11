"use client"

import { GrievanceList } from "@/components/grievances/GrievanceList"

export default function StudentGrievancesPage() {
  return (
    <div className="p-6">
      <GrievanceList detailHrefBase="/student/grievances" submitHref="/student/grievances/submit" />
    </div>
  )
}
