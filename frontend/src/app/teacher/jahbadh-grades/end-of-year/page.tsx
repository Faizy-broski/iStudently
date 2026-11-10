"use client"

import { Suspense } from "react"
import { EndOfYear } from "@/components/jahbadh/InsightQuality"

export default function Page() {
  return <Suspense><EndOfYear base="/teacher/jahbadh-grades" /></Suspense>
}
