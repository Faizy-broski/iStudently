"use client"

import { GrievanceSubmitForm } from "@/components/grievances/GrievanceSubmitForm"

export default function ParentGrievanceSubmitPage() {
  return (
    <div className="p-6">
      <GrievanceSubmitForm listHref="/parent/grievances" />
    </div>
  )
}
