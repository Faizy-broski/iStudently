"use client"

import { Suspense } from "react"
import { InsightSettings } from "@/components/jahbadh/InsightAdmin"

export default function Page() {
  return <Suspense><InsightSettings base="/admin/jahbadh-grades" /></Suspense>
}
