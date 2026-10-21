"use client"

import { Suspense } from "react"
import { SubjectAnalysis } from "@/components/jahbadh/Tools"

export default function Page() {
  return <Suspense><SubjectAnalysis base="/teacher/jahbadh-grades" /></Suspense>
}
