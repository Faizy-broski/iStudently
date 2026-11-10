"use client"

import { Suspense } from "react"
import { InsightHub } from "@/components/jahbadh/InsightAdmin"

export default function Page() {
  return <Suspense><InsightHub base="/admin/jahbadh-grades" /></Suspense>
}
