"use client"

// Student: Schedule — a student sees their own schedule directly.
// Uses the same StudentScheduleDetail component; student ID is pulled from auth context.
import { useAuth } from "@/context/AuthContext"
import { StudentScheduleDetail } from "@/components/scheduling/StudentScheduleDetail"
import { Loader2 } from "lucide-react"

export default function StudentSchedulePage() {
  const { profile, user } = useAuth()

  // The student's own profile id is their student id
  const studentId = profile?.student_id as string | undefined

  if (!user || !studentId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <StudentScheduleDetail
      student={{
        id: studentId,
        name: `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim(),
        student_number: profile?.student_number || "",
        grade_level: profile?.grade_level || null,
      }}
      // Student views only their own schedule — back button is hidden by styling onBack as no-op
      onBack={() => {}}
    />
  )
}

