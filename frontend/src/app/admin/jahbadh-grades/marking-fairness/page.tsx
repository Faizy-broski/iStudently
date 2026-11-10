"use client"

import { Suspense } from "react"
import { MarkingFairness } from "@/components/jahbadh/InsightAdmin"

export default function Page() {
  return <Suspense><MarkingFairness base="/admin/jahbadh-grades" /></Suspense>
}
