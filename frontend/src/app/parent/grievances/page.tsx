"use client"

import { GrievanceList } from "@/components/grievances/GrievanceList"

export default function ParentGrievancesPage() {
  return (
    <div className="p-6">
      <GrievanceList detailHrefBase="/parent/grievances" submitHref="/parent/grievances/submit" />
    </div>
  )
}
