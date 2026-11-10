"use client"

import { Suspense } from "react"
import { SectionAllocation } from "@/components/jahbadh/InsightAdmin"

export default function Page() {
  return <Suspense><SectionAllocation base="/admin/jahbadh-grades" /></Suspense>
}
