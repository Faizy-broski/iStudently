"use client"

import { Suspense } from "react"
import { EntryProgress } from "@/components/jahbadh/InsightQuality"

export default function Page() {
  return <Suspense><EntryProgress base="/teacher/jahbadh-grades" /></Suspense>
}
