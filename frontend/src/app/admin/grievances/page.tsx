"use client"

import { GrievanceList } from "@/components/grievances/GrievanceList"

export default function AdminGrievancesPage() {
  return (
    <div className="p-6">
      <GrievanceList detailHrefBase="/admin/grievances" submitHref="/admin/grievances/submit" isAdmin />
    </div>
  )
}
