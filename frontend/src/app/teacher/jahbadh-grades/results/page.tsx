"use client"

import { Suspense } from "react"
import { ResultsSheet } from "@/components/jahbadh/ResultsSheet"

export default function Page() {
  return <Suspense><ResultsSheet base="/teacher/jahbadh-grades" /></Suspense>
}
