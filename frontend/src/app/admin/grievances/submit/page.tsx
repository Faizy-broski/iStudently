"use client"

import { GrievanceSubmitForm } from "@/components/grievances/GrievanceSubmitForm"

export default function AdminGrievanceSubmitPage() {
  return (
    <div className="p-6">
      <GrievanceSubmitForm listHref="/admin/grievances" />
    </div>
  )
}
