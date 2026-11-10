"use client"

import { Suspense } from "react"
import { Approval } from "@/components/jahbadh/InsightQuality"

export default function Page() {
  return <Suspense><Approval base="/admin/jahbadh-grades" /></Suspense>
}
