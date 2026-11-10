"use client"

import { Suspense } from "react"
import { Verification } from "@/components/jahbadh/InsightQuality"

export default function Page() {
  return <Suspense><Verification base="/admin/jahbadh-grades" /></Suspense>
}
