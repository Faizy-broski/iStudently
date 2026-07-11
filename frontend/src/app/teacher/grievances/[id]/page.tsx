"use client"

import { useParams } from "next/navigation"
import { GrievanceThread } from "@/components/grievances/GrievanceThread"

export default function TeacherGrievanceDetailPage() {
  const params = useParams<{ id: string }>()
  return (
    <div className="p-6">
      <GrievanceThread grievanceId={params.id} listHref="/teacher/grievances" />
    </div>
  )
}
