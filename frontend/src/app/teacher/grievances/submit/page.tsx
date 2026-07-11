"use client"

import { GrievanceSubmitForm } from "@/components/grievances/GrievanceSubmitForm"

export default function TeacherGrievanceSubmitPage() {
  return (
    <div className="p-6">
      <GrievanceSubmitForm listHref="/teacher/grievances" />
    </div>
  )
}
