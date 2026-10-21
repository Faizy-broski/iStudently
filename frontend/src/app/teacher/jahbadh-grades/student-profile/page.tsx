"use client"

import { Suspense } from "react"
import { StudentProfile } from "@/components/jahbadh/Insights"

export default function Page() {
  return <Suspense><StudentProfile base="/teacher/jahbadh-grades" /></Suspense>
}
