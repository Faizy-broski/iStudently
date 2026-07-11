"use client"

import { GrievanceSubmitForm } from "@/components/grievances/GrievanceSubmitForm"

export default function LibrarianGrievanceSubmitPage() {
  return (
    <div className="p-6">
      <GrievanceSubmitForm listHref="/librarian/grievances" />
    </div>
  )
}
