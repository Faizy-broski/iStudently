"use client"

import { Suspense } from "react"
import { AbsenceImpact } from "@/components/jahbadh/InsightPlanning"

export default function Page() {
  return <Suspense><AbsenceImpact base="/admin/jahbadh-grades" /></Suspense>
}
