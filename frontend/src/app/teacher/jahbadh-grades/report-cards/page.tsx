"use client"

import { Suspense } from "react"
import { ReportCards } from "@/components/jahbadh/ReportCards"

export default function Page() {
  return <Suspense><ReportCards base="/teacher/jahbadh-grades" /></Suspense>
}
