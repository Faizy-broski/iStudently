"use client"

import { Suspense } from "react"
import { EntryAudit } from "@/components/jahbadh/InsightQuality"

export default function Page() {
  return <Suspense><EntryAudit base="/teacher/jahbadh-grades" /></Suspense>
}
