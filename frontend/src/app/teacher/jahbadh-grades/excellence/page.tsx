"use client"

import { Suspense } from "react"
import { Excellence } from "@/components/jahbadh/InsightQuality"

export default function Page() {
  return <Suspense><Excellence base="/teacher/jahbadh-grades" /></Suspense>
}
