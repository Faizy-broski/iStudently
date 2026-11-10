"use client"

import { Suspense } from "react"
import { Certificates } from "@/components/jahbadh/InsightQuality"

export default function Page() {
  return <Suspense><Certificates base="/admin/jahbadh-grades" /></Suspense>
}
