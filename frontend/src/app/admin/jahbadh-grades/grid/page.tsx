"use client"

import { Suspense } from "react"
import { GradeGrid } from "@/components/jahbadh/GradeGrid"

export default function Page() {
  return <Suspense><GradeGrid base="/admin/jahbadh-grades" /></Suspense>
}
