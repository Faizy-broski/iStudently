"use client"

import { Suspense } from "react"
import { GradeGrid } from "@/components/jahbadh/GradeGrid"

export default function Page() {
  return <Suspense><GradeGrid base="/teacher/jahbadh-grades" /></Suspense>
}
