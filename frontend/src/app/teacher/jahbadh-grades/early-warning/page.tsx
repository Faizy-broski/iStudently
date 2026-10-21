"use client"

import { Suspense } from "react"
import { EarlyWarning } from "@/components/jahbadh/Insights"

export default function Page() {
  return <Suspense><EarlyWarning base="/teacher/jahbadh-grades" /></Suspense>
}
