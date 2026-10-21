"use client"

import { Suspense } from "react"
import { EarlyWarning } from "@/components/jahbadh/Insights"

export default function Page() {
  return <Suspense><EarlyWarning base="/admin/jahbadh-grades" /></Suspense>
}
