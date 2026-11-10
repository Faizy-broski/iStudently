"use client"

import { Suspense } from "react"
import { Inflation } from "@/components/jahbadh/InsightPlanning"

export default function Page() {
  return <Suspense><Inflation base="/teacher/jahbadh-grades" /></Suspense>
}
