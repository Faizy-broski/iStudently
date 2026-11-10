"use client"

import { Suspense } from "react"
import { EdgeStudents } from "@/components/jahbadh/InsightPlanning"

export default function Page() {
  return <Suspense><EdgeStudents base="/teacher/jahbadh-grades" /></Suspense>
}
