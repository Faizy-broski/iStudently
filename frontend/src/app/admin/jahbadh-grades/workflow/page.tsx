"use client"

import { Suspense } from "react"
import { Workflow } from "@/components/jahbadh/InsightAdmin"

export default function Page() {
  return <Suspense><Workflow base="/admin/jahbadh-grades" /></Suspense>
}
