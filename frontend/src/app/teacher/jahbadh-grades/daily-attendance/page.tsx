"use client"

import { Suspense } from "react"
import { DailyAttendance } from "@/components/jahbadh/DailyAttendance"

export default function Page() {
  return <Suspense><DailyAttendance base="/teacher/jahbadh-grades" /></Suspense>
}
