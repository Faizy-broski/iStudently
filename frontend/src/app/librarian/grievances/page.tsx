"use client"

import { GrievanceList } from "@/components/grievances/GrievanceList"

export default function LibrarianGrievancesPage() {
  return (
    <div className="p-6">
      <GrievanceList detailHrefBase="/librarian/grievances" submitHref="/librarian/grievances/submit" />
    </div>
  )
}
