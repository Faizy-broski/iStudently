"use client"

import { Suspense } from "react"
import { PerformanceDashboard } from "@/components/jahbadh/Insights"

export default function Page() {
  return <Suspense><PerformanceDashboard base="/teacher/jahbadh-grades" /></Suspense>
}
